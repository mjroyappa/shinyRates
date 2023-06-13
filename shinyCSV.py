import math
import requests
import json
import os.path
import csv
import re	#regex
from datetime import datetime

# adopted from https://stackoverflow.com/a/14011299/2532749
def getlowestfraction(x0):
    eps = 1.0E-6

    x = x0
    a = math.floor(x)
    h1 = 1
    k1 = 0
    h = a
    k = 1

    while (x - a > eps * k * k):
        x = 1 / (x - a)
        a = math.floor(x)
        h2 = h1
        h1 = h
        k2 = k1
        k1 = k
        h = h2 + a * h1
        k = k2 + a * k1

    return "1/" + str(math.floor(k / h))

if __name__ == "__main__":
	data = requests.get("https://shinyrates.com/data/rate")
	dataJSON = json.loads(data.text)

	totalShinies = totalChecks = 0
	#suspect 222, 324
	#unsuspect 
	boostedDexNums = [3, 6, 9, 15, 26, 80, 83, 94,
		103, 108, 113, 115, 123, 127, 130, 131, 142, 181, 185,
		204, 211, 214, 215, 227, 254, 257, 260, 263, 282,
		303, 306, 308, 310, 349, 354, 362, 366, 370, 374,
		428, 443, 459,
		531, 564, 594, 568,
		610, 618, 633, 653, 686]

	for i in range(len(dataJSON)):
		pok = dataJSON[i]
		# print(pok)

		#row format:	timestamp | rate fraction | total # of shinies | total # of checks
		oldRows = []
		individualShinies = individualChecks = individualDays = 0
		pokID = int(pok["id"])
		pokName = pok["name"]
		boosted = pokID in boostedDexNums

		filename = pokName + ".csv"
		# writer wipes file so store old contents to rewrite later (if it already exists)
		# ez temp solution until db is running
		if os.path.isfile(filename):
			with open(filename, newline='') as fOld:
				reader = csv.reader(fOld)

				for row in reader:
					oldRows.append(row)

					if not boosted:
						totalShinies += int(row[2])
						totalChecks += int(row[3])

					individualShinies += int(row[2])
					individualChecks += int(row[3])
					individualDays += 1

		# write new contents to the same file, or create if not exist
		with open(filename, "w", newline='') as fNew:
			writer = csv.writer(fNew)

			for i in range(len(oldRows)):
				writer.writerow(oldRows[i])

			rateStr = pok["rate"].replace(",", "")
			rateInt = int(rateStr[re.search("/", rateStr).span()[1] : ])	#get denominator of rate fraction
			totalInt = int(pok["total"].replace(",", ""))
			shiniesInt = round(totalInt / rateInt)

			if not boosted:
				totalShinies += shiniesInt
				totalChecks += totalInt

			individualShinies += shiniesInt
			individualChecks += totalInt
			individualDays += 1

			tabs = "\t" if len(pokName) + len(str(pokID)) >= 12 else "\t\t"
			print(f'{pokName} (#{pokID}){tabs}LIFETIME RATE|BOOSTED: {getlowestfraction(individualShinies / individualChecks)}\t| {boosted}; DAILY RATE|CHECKS|DAYS: {rateStr} | {totalInt} | {individualDays}')

			writer.writerow([str(datetime.now()), f"1/{rateInt}", shiniesInt, totalInt])

	print("TOTAL LIFETIME RATE =", getlowestfraction(totalShinies / totalChecks))
