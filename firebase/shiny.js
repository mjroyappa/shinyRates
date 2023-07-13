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
	if(entriesCompleted == size * 2) {
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

				var totalShinies = 0, totalChecks = 0;
				// suspect 222, 324
				// unsuspect 
				// const alteredDexNums = [3, 6, 9, 15, 26, 80, 83, 94,
				// 	103, 108, 113, 115, 123, 127, 130, 131, 142, 181, 185,
				// 	204, 211, 214, 215, 227, 254, 257, 260, 263, 282,
				// 	303, 306, 308, 310, 349, 354, 362, 366, 370, 374,
				// 	428, 443, 459,
				// 	531, 564, 566, 594, 568,
				// 	610, 618, 633, 653, 686]

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
						entryNode = `/data/${pokID}/${date.getFullYear()}-${monthStr}-${dayStr}`;

					admin.database().ref(entryNode).once("value").then(snapshot => {
						//if data for today doesn't already exist, add the entry
						if(!snapshot.val()) {
							admin.database().ref(entryNode).set({
								"rate": rateStr, "ignore": false/*ternary for adding comm day entry?*/, "totalShinies": shiniesInt, "totalChecks": checksInt
							}).then(() => { checkProgress(jsonSize); });

							//update totals in pokemon section
							admin.database().ref("/pokemon/" + pokID).update({
								"totalShinies": admin.database.ServerValue.increment(shiniesInt),
								"totalChecks": admin.database.ServerValue.increment(checksInt)
							}).then(() => { checkProgress(jsonSize); });
						}
					});

					console.log(pokName + ":", shiniesInt, "/", checksInt);
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