'use strict'

// Import the functions you need from the SDKs you need
const admin = require("firebase-admin");
const https = require("https");
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://shinyrates-default-rtdb.firebaseio.com"
});

function checkProgress(size) {
	entriesCompleted++;
	if(entriesCompleted == size) {
		process.exit();
	}
}

var options = {
		host: 'shinyrates.com',
		path: '/data/rate',
		headers: {'User-Agent': 'request'}
	},
	entriesCompleted = 0;

https.get(options, function (res) {
	var json = '';
	res.on('data', function (chunk) {
		json += chunk;
	});
	res.on('end', function () {
		if (res.statusCode === 200) {
			try {
				const dataJSON = JSON.parse(json),
					jsonSize = dataJSON.length;

				for (var i = 0; i < jsonSize; i++) {
					const pok = dataJSON[i];	//current poke (data from shinyrates.com)
					// console.log(pok);

					let pokID = parseInt(pok["id"]),
						pokName = pok["name"],
						// standard = !alteredDexNums.includes(pokID),
						rateStr = pok["rate"].replace(",", ""),
						rateInt = parseInt(rateStr.split("/")[1]),  //denominator of rate fraction
						checksInt = parseInt(pok["total"].replace(",", "")),
						shiniesInt = Math.round(checksInt / rateInt),
						date = new Date(),
						day = date.getDate(),
						month = date.getMonth(), //month is zero-indexed ??
						dayStr = day < 10 ? "0" + day : day,
						monthStr = month < 10 ? "0" + (month + 1) : month + 1 + "",
						entryNode = `data/${pokID}/${date.getFullYear()}-${monthStr}-${dayStr}`;

					admin.database().ref(entryNode).once("value").then(snapshot => {
						//if data for today doesn't already exist, add the entry
						if(!snapshot.val()) {
							// console.log("adding", pokID, " at ", rateStr, "(", shiniesInt, "/", checksInt, ")");
							admin.database().ref(entryNode).set({
								"rate": rateStr,
								/*ternary for adding comm day entry? currently updates with trigger if manually changed in rtdb*/
								"ignore": false,
								"totalShinies": shiniesInt,
								"totalChecks": checksInt
							}).then(() => { checkProgress(jsonSize); });

							//totals update with firebase trigger
						}
					});

					// console.log(pokName + ":", shiniesInt, "/", checksInt);
				}
					
			} catch (e) {
				console.log('Error!', e);
			}
		} else {
			console.log('Status:', res.statusCode);
		}
	});
}).on('error', function (err) {
	console.log('Error:', err);
});