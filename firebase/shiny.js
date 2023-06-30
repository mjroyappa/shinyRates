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

//https://stackoverflow.com/a/14011299/2532749
function getlowestfraction(x0) {
	var eps = 1.0E-6;
	var h, h1, h2, k, k1, k2, a, x;

	x = x0;
	a = Math.floor(x);
	h1 = 1;
	k1 = 0;
	h = a;
	k = 1;

	while (x - a > eps * k * k) {
		x = 1 / (x - a);
		a = Math.floor(x);
		h2 = h1;
		h1 = h;
		k2 = k1;
		k1 = k;
		h = h2 + a * h1;
		k = k2 + a * k1;
	}

	return "1/" + String(Math.floor(k / h));
}

function checkStatus(size) {
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
				const alteredDexNums = [3, 6, 9, 15, 26, 80, 83, 94,
					103, 108, 113, 115, 123, 127, 130, 131, 142, 181, 185,
					204, 211, 214, 215, 227, 254, 257, 260, 263, 282,
					303, 306, 308, 310, 349, 354, 362, 366, 370, 374,
					428, 443, 459,
					531, 564, 566, 594, 568,
					610, 618, 633, 653, 686]

				var entriesCompleted = 0;
				for (var i = 0; i < jsonSize; i++) {
					const pok = dataJSON[i];	//current poke (data from shinyrates.com)
					// console.log(pok);

					let pokID = parseInt(pok["id"]),
						pokName = pok["name"],
						standard = !alteredDexNums.includes(pokID),
						rateStr = pok["rate"].replace(",", ""),
						rateInt = parseInt(rateStr.split("/")[1]),  //denominator of rate fraction
						checksInt = parseInt(pok["total"].replace(",", "")),
						shiniesInt = Math.round(checksInt / rateInt),
						individualShinies = shiniesInt,
						individualChecks = checksInt;

					const date = new Date(),
						month = date.getMonth(),	//month is zero-indexed ??
						monthStr = month < 10 ? "0" + (month + 1) : month + 1 + "",
						entryNode = `/data/${pokID}/${date.getFullYear()}-${monthStr}-${date.getDate()}`;

					admin.database().ref(entryNode).once("value").then(snapshot => {
						//if data for today doesn't already exist, add the entry
						if(!snapshot.val()) {
							admin.database().ref(entryNode).set({
								"rate": rateStr, "ignore": false, "totalShinies": shiniesInt, "totalChecks": checksInt
							}).then(() => { checkStatus(jsonSize); });

							admin.database().ref("/pokemon/" + pokID).once("value").then(snapshot => {
								const pokDB = snapshot.val();
								//update totals in pokemon section
								admin.database().ref("/pokemon/" + pokID).update({
									"totalShinies": pokDB["totalShinies"] + shiniesInt, "totalChecks": pokDB["totalChecks"] + checksInt
								}).then(() => { checkStatus(jsonSize); });
							});
						}
					});

				// 		tabs = "\t" if len(pokName) + len(str(pokID)) >= 12 else "\t\t"
				// 		print(f'{pokName} (#{pokID}){tabs}LIFETIME RATE|standard: {getlowestfraction(individualShinies / individualChecks)}\t| {standard}; DAILY RATE|CHECKS|DAYS: {rateStr} | {totalInt} | {individualDays}')

				// 		writer.writerow([str(datetime.now()), f"1/{rateInt}", shiniesInt, totalInt])

					// console.log("TOTAL LIFETIME RATE =", getlowestfraction(totalShinies / totalChecks));
					console.log(pokName + ":", individualShinies, "/", individualChecks);
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