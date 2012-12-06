// batteryMonitor

// to initilize batteryMonitor the following must be called
// batteryMonitor.init({
//		curState: "ID for Element to display current State of battery"
//		logger: "ID for Element to displaying logging info"
//		startButton: "ID for start button"
//		stopButton: "ID for stop button"
// });

var batteryMonitor = function() {'use strict';
	// UNIVERSAL variables //
	// used to determine if module is being call for test suites
	var ISTESTING = true,
	// DOM/UI related variables //
	// used to store Element for displaying current state
	CURRENT_STATE_ELEMENT = null,
	// used to store Element for displaying logging info
	LOGGING_ELEMENT = null,
	// used to store Element for startButton
	START_BTN_ELEMENT = null,
	// used to store Element for stopButton
	STOP_BTN_ELEMENT = null,
	// array of elements for GUI tabs
	TABS_ARRAY = [],
	// element for Year selection
	SELECT_YEAR_ELEMENT = null,
	// element for Month selection
	SELECT_MONTH_ELEMENT = null,
	// element for Day selection
	SELECT_DAY_ELEMENT = null,
	// element for displaying Month selection
	FILTER_MONTH_ELEMENT = null,
	// element for displaying Day selection
	FILTER_DAY_ELEMENT = null,
	// element for displaying total draining rate
	TOTAL_DRAINING_ELEMENT = null,
	// element for displaying total charging rate
	TOTAL_CHARGING_ELEMENT = null,
	// element for displaying avg drain rate
	AVG_DRAIN_ELEMENT = null,
	// element for displaying avg charge rate
	AVG_CHARGE_ELEMENT = null,
	// element for displaying numer of sessions
	SESSION_NUM_ELEMENT = null,

	// Battery Status tracking variables
	// store current battery level
	CUR_LVL = 0,
	// current state (isPlugged) [True/False]
	CUR_STATE = null,
	// track length of level
	LVL_TIME = null,
	// track length of state
	STATE_TIME = null,
	// track tracking interval
	START_TIME = null,
	// track amount of time between battery status change
	INTERVAL = null,
	// amount of time device has been in charging state
	CHARGE_TIME = 0,
	// amount of time device has been in draining state
	DRAIN_TIME = 0,
	// total amount of charge completed
	CHARGE_TOTAL = 0,
	// total amount of drain completed
	DRAIN_TOTAL = 0,
	// used to identify Initial Battery Level read
	// we want to ignore the initial reading as it will provide
	//incorrect calculations							*/
	IS_INITLEVEL = true,

	// MAGIC NUMBERS //
	// # of milliseconds in a second
	MSINS = 1000,
	// # of seconds in an hour
	SINH = 60 * 60,

	// Database Variables //
	DB_NAME = "BatteryMonDB", DB_VERSION = "0.1", DB_DISPLAYNAME = "ShaunsApps Battery Monitor database", DB_ESTSIZE = 1024 * 1024, TB_NAME = "stats", DEVICEPIN = null, DEVICEOS = null, TRACKSESSION = null,
	// used to hold database
	DB_OBJECT = null,
	// used as default filter for History
	DEFAULTFILTER = null;

	// Helper functions //
	// getTimeStamp
	//
	// @parm date (date element)
	// returns timpstamp in following format
	//  "YYYY-MM-DD HH:MM:SS:MSX
	function getTimeStamp(date) {
		try {
			var timestamp = date.getFullYear() + "-";
			if ((date.getMonth() + 1) < 10)
				timestamp += 0;
			timestamp += date.getMonth() + 1 + "-";
			//need +1 as Months =[0,11]
			if (date.getDate() < 10)
				timestamp += 0;
			timestamp += date.getDate() + " ";
			if (date.getHours() < 10)
				timestamp += 0;
			timestamp += date.getHours() + ":";
			if (date.getMinutes() < 10)
				timestamp += 0;
			timestamp += date.getMinutes() + ":";
			if (date.getSeconds() < 10)
				timestamp += 0;
			timestamp += date.getSeconds() + ":";
			if (date.getMilliseconds() < 100)
				timestamp += 0;
			timestamp += date.getMilliseconds();
			return timestamp;
		} catch (err) {
			alert("error getting TimeStamp -" + err);
		}
	};

	// confirms value is a number
	function isNumber(value) {
		return typeof value === 'number' && isFinite(value);
	}

	// DOM Manipulation functions
	function hideAllTabs() {
		var i;
		for ( i = 0; i < TABS_ARRAY.length; i++) {
			document.getElementById(TABS_ARRAY[i]).style.display = 'none';
		}
	};

	var _filterWyear = "";
	var _filterWmonth = "";

	// DATABASE FUNCTIONS //

	// Database query functions //
	// open database
	var db_open = function() {
		console.log("attempting to open database");
		DB_OBJECT = openDatabase(DB_NAME, DB_VERSION, DB_DISPLAYNAME, DB_ESTSIZE, function() {
			console.log("opened database successfully!");
		});
	};
	// generic error callback
	var db_onError = function(tx, e) {
		var msg = "Database Error: " + e.message;
		alert(msg);
		console.log(msg);
	};
	// generic success callback
	var db_onSuccess = function(tx, rs) {
		//alert("Successful");
	};
	// can be used for all database queries
	var db_query = function(statement, items, onSuccess, onError) {
		var db = DB_OBJECT;
		console.log(statement);
		db.transaction(function(tx) {
			tx.executeSql(statement, items, onSuccess, onError);
		});
	};
	// DATABASE HELPERS
	/* database initialization */
	function db_init() {
		DEVICEPIN = blackberry.identity.uuid;
		DEVICEOS = blackberry.system.softwareVersion;
		//TRACKSESSION = 0;
		console.log("+db_init called");
		db_open();
		var statement = 'CREATE TABLE IF NOT EXISTS ' + TB_NAME + '(ID INTEGER PRIMARY KEY ASC, pin STRING, os STRING, session INTEGER, level INTEGER, ischarging INTEGER, islevelchg INTEGER, levelchgtime INTEGER, year INTEGER, month INTEGER, day INTEGER, hour INTEGER, minute INTEGER, second INTEGER)'
		db_query(statement, [], db_onSuccess, db_onError);

		statement = "SELECT * FROM " + TB_NAME;
		db_query(statement, [], dbDisplayAll, db_onError);
		DEFAULTFILTER = "WHERE pin='" + DEVICEPIN + "' AND os='" + DEVICEOS + "'";
		statement = "SELECT DISTINCT year AS result FROM " + TB_NAME + " " + DEFAULTFILTER;
		if (!ISTESTING) {
			updateHistStats(DEFAULTFILTER);
			db_query(statement, [], updateYearFilter, db_onError);
		}
	};

	function db_insertDemoData() {
		// delete everything from table
		db_query("DELETE FROM " + TB_NAME, [], db_onSuccess, db_onError);
		// insert demo data
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 100, 0, 0, 0, 2011, 12, 25, 14, 30, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 99, 0, 1, 120, 2011, 12, 25, 14, 32, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 98, 0, 1, 180, 2011, 12, 25, 14, 35, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 97, 0, 1, 240, 2011, 12, 25, 14, 39, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 96, 0, 1, 300, 2011, 12, 25, 14, 44, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 95, 0, 1, 360, 2011, 12, 25, 14, 50, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 94, 0, 1, 420, 2011, 12, 25, 14, 57, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 93, 0, 1, 480, 2011, 12, 25, 15, 05, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 92, 0, 1, 540, 2011, 12, 25, 15, 14, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 91, 0, 1, 600, 2011, 12, 25, 15, 24, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 1, 90, 0, 1, 660, 2011, 12, 25, 15, 35, 00], db_onSuccess, db_onError);

		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 2, 1, 0, 0, 2012, 11, 16, 23, 00, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 3, 1, 1, 60, 2012, 11, 16, 23, 01, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 4, 1, 1, 60, 2012, 11, 16, 23, 02, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 5, 1, 1, 60, 2012, 11, 16, 23, 03, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 6, 1, 1, 60, 2012, 11, 16, 23, 04, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 7, 1, 1, 60, 2012, 11, 16, 23, 05, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 8, 1, 1, 60, 2012, 11, 16, 23, 06, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 9, 1, 1, 60, 2012, 11, 16, 23, 07, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 10, 1, 1, 60, 2012, 11, 16, 23, 08, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 11, 1, 1, 60, 2012, 11, 16, 23, 09, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 2, 12, 1, 1, 60, 2012, 11, 16, 23, 10, 00], db_onSuccess, db_onError);

		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 50, 1, 0, 0, 2012, 12, 01, 12, 00, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 51, 1, 1, 65, 2012, 12, 01, 12, 01, 05], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 52, 1, 1, 65, 2012, 12, 01, 12, 02, 10], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 53, 1, 1, 65, 2012, 12, 01, 12, 03, 15], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 54, 1, 1, 65, 2012, 12, 01, 12, 04, 20], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 55, 1, 1, 65, 2012, 12, 01, 12, 05, 25], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 56, 1, 1, 65, 2012, 12, 01, 12, 06, 30], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 57, 1, 1, 65, 2012, 12, 01, 12, 07, 35], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 58, 1, 1, 65, 2012, 12, 01, 12, 08, 40], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 59, 1, 1, 65, 2012, 12, 01, 12, 09, 45], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 1, 1, 65, 2012, 12, 01, 12, 10, 50], db_onSuccess, db_onError);

		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 0, 0, 2012, 12, 01, 12, 11, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 1, 120, 2012, 12, 01, 12, 12, 00], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 1, 125, 2012, 12, 01, 12, 14, 05], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 1, 130, 2012, 12, 01, 12, 16, 15], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 1, 135, 2012, 12, 01, 12, 18, 30], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 1, 140, 2012, 12, 01, 12, 20, 50], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 1, 100, 2012, 12, 01, 12, 22, 30], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 1, 120, 2012, 12, 01, 12, 24, 30], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 1, 50, 2012, 12, 01, 12, 25, 20], db_onSuccess, db_onError);
		db_query("INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [DEVICEPIN, DEVICEOS, 3, 60, 0, 1, 70, 2012, 12, 01, 12, 26, 10], db_onSuccess, db_onError);

	}

	function updateHistStats(filter) {
		/* determine if there are any historical stats for PIN */
		var statement = "SELECT COUNT(DISTINCT session) AS result FROM " + TB_NAME + " " + filter;
		db_query(statement, [], updateNumSessionStats, db_onError)
		statement = 'SELECT AVG(levelchgtime) AS avg FROM ' + TB_NAME + " " + filter + " AND islevelchg=1 AND ischarging=1";
		db_query(statement, [], updateAvgChargeStats, db_onError);
		statement = 'SELECT AVG(levelchgtime) AS avg FROM ' + TB_NAME + " " + filter + " AND islevelchg=1 AND ischarging=0";
		db_query(statement, [], updateAvgDrainStats, db_onError)
		statement = 'SELECT SUM(levelchgtime) AS sum FROM ' + TB_NAME + " " + filter + " AND islevelchg=1 AND ischarging=1";
		db_query(statement, [], updateTotalChargeTimeStats, db_onError);
		statement = 'SELECT SUM(levelchgtime) AS sum FROM ' + TB_NAME + " " + filter + " AND islevelchg=1 AND ischarging=0";
		db_query(statement, [], updateTotalDrainTimeStats, db_onError);
	};

	// DATABASE RESULTS FUNCTIONS //
	function dbDisplayAll(tx, rs) {
		console.log("+dbDisplayAll - called with " + rs.rows.length + " rows");
		for (var i = 0; i < rs.rows.length; i++) {
			var output = renderRow(rs.rows.item(i));
			console.log(output);
		}
	};

	/* returns data separated by | */
	function renderRow(row) {
		return row.pin + " | " + row.os + " | " + row.session + " | " + row.level + " | " + row.ischarging + " | " + row.islevelchg + " | " + row.levelchgtime + " | " + row.year + " | " + row.month + " | " + row.day + " | " + row.hour + ":" + row.minute + ":" + row.second;
	};

	function updateYearFilter(tx, rs) {
		var node = document.getElementById(SELECT_YEAR_ELEMENT);
		updateSelectOptions(node, rs);
	};

	function updateMonthFilter(tx, rs) {
		document.getElementById(FILTER_MONTH_ELEMENT).style.display = "block";
		var node = document.getElementById(SELECT_MONTH_ELEMENT);
		updateSelectOptions(node, rs);
	};

	function updateDayFilter(tx, rs) {
		document.getElementById(FILTER_DAY_ELEMENT).style.display = "block";
		var node = document.getElementById(SELECT_DAY_ELEMENT);
		updateSelectOptions(node, rs);
	};

	function updateSelectOptions(select, rs) {
		// first remove all child elements
		while (select.hasChildNodes()) {
			select.removeChild(select.lastChild);
		}
		//now repopulate it
		var opt = document.createElement("option");
		opt.setAttribute("value", "ALL");
		opt.setAttribute("selected", "true");
		opt.innerHTML = "ALL";
		select.appendChild(opt);
		for (var i = 0; i < rs.rows.length; i++) {
			opt = document.createElement("option");
			opt.setAttribute('value', rs.rows.item(i).result);
			opt.innerHTML = rs.rows.item(i).result;
			select.appendChild(opt);
		}
		select.refresh();
	};

	function updateTotalDrainTimeStats(tx, rs) {
		var rate = 0;
		var out = "";
		if (rs.rows.length > 0 && rs.rows.item(0).sum !== null) {
			rate = rs.rows.item(0).sum;
			rate = rate.toFixed(2)
		}
		document.getElementById(TOTAL_DRAINING_ELEMENT).innerHTML = rate + ' seconds';
	};

	function updateTotalChargeTimeStats(tx, rs) {
		var rate = 0;
		if (rs.rows.length > 0 && rs.rows.item(0).sum !== null) {
			rate = rs.rows.item(0).sum;
			rate = rate.toFixed(2);
		}
		document.getElementById(TOTAL_CHARGING_ELEMENT).innerHTML = rate + ' seconds';
	};

	function updateAvgDrainStats(tx, rs) {
		var rate = 0;
		var per = '';
		if (rs.rows.length > 0 && rs.rows.item(0).avg !== null) {
			rate = rs.rows.item(0).avg;
			rate = (SINH / rate).toFixed(2);
			per = "%/hour";
		}
		document.getElementById(AVG_DRAIN_ELEMENT).innerHTML = rate + per;
	};

	function updateAvgChargeStats(tx, rs) {
		var rate = 0;
		var per = '';
		if (rs.rows.length > 0 && rs.rows.item(0).avg !== null) {
			rate = rs.rows.item(0).avg;
			rate = (SINH / rate).toFixed(2);
			per = "%/hour";
		}
		document.getElementById(AVG_CHARGE_ELEMENT).innerHTML = rate + per;
	};

	function updateNumSessionStats(tx, rs) {
		var nSessions = 0;
		if (rs.rows.length > 0 && rs.rows.item(0).result !== null) {
			var nSessions = rs.rows.item(0).result;
		}
		document.getElementById(SESSION_NUM_ELEMENT).innerHTML = nSessions;
	};

	/* Database callback functions */
	var _result = null;
	function numOfResults(tx, rs) {
		console.log("numOfResults entered with " + rs.rows.length + " results");
		_result = rs.rows.length
	};

	function returnResult(tx, rs) {
		_result = rs.rows.item(0).result;
	};

	/* used to determine TrackingSession number to use */
	function determineSession(tx, rs) {
		if (rs.rows.length === 0) {
			TRACKSESSION = 0;
		} else {
			var maxsession = rs.rows.item(0).max;
			TRACKSESSION = maxsession + 1;
		}
		console.log("TrackingSession = " + TRACKSESSION);
	};

	/* used to determine max session from historical data */
	function maxsession(tx, rs) {
		if (rs.rows.length === 0) {
			return 0;
		} else {
			return rs.rows.item(0).max;
		}
	};

	// Battery tracking functions //
	//BatteryMonitor_init
	//params
	// 	curStateElement:	DOM Element used to track current Battery State to the User
	// 	logElement:			DOM Element used to log updates
	function BatteryMonitor_init() {
		console.log("BatteryMonitor_init");
		var date = new Date();
		START_TIME = date.getTime();
		/* start eventlisteners */
		try {
			// BB10 API
			blackberry.event.addEventListener("batterystatus", onBatteryStatusChg);
			console.log("BatteryMonitor--startListening for batterystatus");
			var date = new Date();
			if (!ISTESTING) {
				document.getElementById(LOGGING_ELEMENT).innerHTML += getTimeStamp(date) + " starting tracking<br>";
			}
		} catch(err) {
			alert("failed to start event listener: " + err);
		}
	};

	function onBatteryStatusChg(info) {
		console.log("+onBatteryStatusChg called");
		try {
			var date = new Date();
			var curTime = date.getTime();
			var curTime = curTime / MSINS;
			//put into seconds
			var msg = "Plugged in:" + info.isPlugged + "<br>Battery Level:" + info.level + "%";
			var logMsg = getTimeStamp(date);

			/* stat related vars */
			var chgInterval = 0;
			var isLevelChg = 0;

			if (CUR_STATE === null) {
				// first battery status change
				CUR_STATE = info.isPlugged;
				// begin measuring battery level after this
				CUR_LVL = info.level;

				INTERVAL = curTime;
				logMsg = logMsg + " inital status::Level=" + info.level + " isPlugged=" + info.isPlugged;
			} else {
				if (CUR_STATE !== info.isPlugged) {
					// Plugged in state has changed
					console.log("state changed");
					logMsg = logMsg + " state changed::Charging=" + info.isPlugged + ":: ";
					// if False track drain
					// if True track charge
					CUR_STATE = info.isPlugged;
					CUR_LVL = info.level;

					if (CUR_LVL) {
						CHARGE_TIME += (curTime - INTERVAL);
					} else {
						DRAIN_TIME += (curTime - INTERVAL);
					}

				} else {
					// Battery Level changed
					// confirm level changed
					if (CUR_LVL === info.level) {
						console.log("**misfire: status changed yet level & charging state haven't changed: bad charging?");
						return;
					}
					console.log("battery level changed");
					logMsg = logMsg + " level changed::Level=" + info.level + ":: ";

					// stat related vars
					isLevelChg = 1;
					chgInterval = curTime - INTERVAL;
					if (info.isPlugged) {
						// Track charge (assuming changing by 1% every time

						CHARGE_TIME += chgInterval;
						CHARGE_TOTAL++;
						logMsg = logMsg + "charge Total:" + CHARGE_TOTAL + "\ncharge Time:" + CHARGE_TIME;
						console.log(logMsg);

					} else {
						// Track drain
						DRAIN_TIME += chgInterval;
						;
						DRAIN_TOTAL++;
						logMsg = logMsg + "drain Total:" + DRAIN_TOTAL + "\ndrain Time:" + DRAIN_TIME;
						console.log(logMsg);
					}
				}
			}
			//console.log(info.isPlugged);
			//console.log(info.level);
			var drainRate = DRAIN_TOTAL / DRAIN_TIME;
			// % per second
			var chargeRate = CHARGE_TOTAL / CHARGE_TIME;
			// % per second
			// 60 seconds a minute|60 minutes a hour == 3600
			if (isNumber(drainRate)) {
				drainRate = (drainRate * SINH).toFixed(2);
			} else {
				drainRate = '--';
			}
			if (isNumber(chargeRate)) {
				chargeRate = (chargeRate * SINH).toFixed(2);
			} else {
				chargeRate = '--';
			}
			msg = msg + "<br>Avg Drain Rate:" + drainRate + "%/hour<br>Avg Charge Rate:" + chargeRate + "%/hour";
			console.log(msg);
			document.getElementById(CURRENT_STATE_ELEMENT).innerHTML = msg;

			logMsg = logMsg + "<br>";
			document.getElementById(LOGGING_ELEMENT).innerHTML += logMsg;

			INTERVAL = curTime;

			var isPlugged = 0;
			if (info.isPlugged)
				isPlugged = 1;

			var year = date.getFullYear();
			var month = date.getMonth() + 1;
			var day = date.getDate();
			var hour = date.getHours();
			var min = date.getMinutes();
			var sec = date.getSeconds();
			var statement = "INSERT INTO " + TB_NAME + "(pin, os, session, level, ischarging, islevelchg, levelchgtime, year, month, day, hour, minute, second) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";
			db_query(statement, [DEVICEPIN, DEVICEOS, TRACKSESSION, info.level, isPlugged, isLevelChg, chgInterval, year, month, day, hour, min, sec], db_onSuccess, db_onError);
			//batteryMon.webdb.addStat(DEVICEPIN, DEVICEOS, TRACKSESSION, info.level, isPlugged, isLevelChg, chgInterval, date);

		} catch (err) {
			alert("onBatteryChg::" + err);
		}
	};

	// objects available to outside world
	return {
		// method to initialize batteryMonitor
		init : function(uiElements) {
			// initialize ui /dom elements
			// use empty array for test suite
			if (uiElements !== {}) {
				ISTESTING = false;
				CURRENT_STATE_ELEMENT = uiElements.curState;
				LOGGING_ELEMENT = uiElements.logger;
				START_BTN_ELEMENT = uiElements.startButton;
				STOP_BTN_ELEMENT = uiElements.stopButton;
				TABS_ARRAY = uiElements.tabs;
				SELECT_YEAR_ELEMENT = uiElements.selectYear;
				SELECT_MONTH_ELEMENT = uiElements.selectMonth;
				SELECT_DAY_ELEMENT = uiElements.selectDay;
				FILTER_MONTH_ELEMENT = uiElements.filterMonth;
				FILTER_DAY_ELEMENT = uiElements.filterDay;
				TOTAL_DRAINING_ELEMENT = uiElements.totalDrain;
				TOTAL_CHARGING_ELEMENT = uiElements.totalCharge;
				AVG_DRAIN_ELEMENT = uiElements.avgDrain;
				AVG_CHARGE_ELEMENT = uiElements.avgCharge;
				SESSION_NUM_ELEMENT = uiElements.sessionNum
			}
			console.log("Testing mode set to: " + ISTESTING)
			db_init();
		},
		// method used to start monitoring battery
		start_monitor : function() {
			console.log("start_battery from js");
			document.getElementById(START_BTN_ELEMENT).style.display = "none";
			document.getElementById(STOP_BTN_ELEMENT).style.display = "inline-block";
			var statement = "SELECT MAX(session) as max FROM " + TB_NAME + " WHERE pin='" + DEVICEPIN + "'";
			db_query(statement, [], determineSession, db_onError);
			BatteryMonitor_init();
		},
		// method used to stop monitoring battery
		stop_monitor : function() {
			blackberry.event.removeEventListener("batterystatus", onBatteryStatusChg);
			console.log("++BatteryMonitor--stopListening for batterystatus");
			document.getElementById(STOP_BTN_ELEMENT).style.display = "none";
			document.getElementById(START_BTN_ELEMENT).style.display = "inline-block";
		},
		filterByYear : function(year) {
			console.log("++ selected Year " + year);
			var filterByYear = DEFAULTFILTER;
			if (year !== "ALL") {
				filterByYear = filterByYear + " AND year=" + year;
				var statement = "SELECT DISTINCT month AS result FROM " + TB_NAME + " " + filterByYear;
				db_query(statement, [], updateMonthFilter, db_onError);
			} else {
				/* hide month and day filter */
				document.getElementById(FILTER_MONTH_ELEMENT).style.display = "none";
				document.getElementById(FILTER_DAY_ELEMENT).style.display = "none";
			}
			_filterWyear = filterByYear;
			updateHistStats(filterByYear);
		},

		filterByMonth : function(month) {
			console.log("++ selected Month " + month);
			var filter = _filterWyear;
			if (month !== "ALL") {
				filter = filter + " AND month=" + month;
				var statement = "SELECT DISTINCT day AS result FROM " + TB_NAME + " " + filter;
				db_query(statement, [], updateDayFilter, db_onError);
			} else {
				/* hide day filter */
				document.getElementById(FILTER_DAY_ELEMENT).style.display = "none";
			}
			_filterWmonth = filter;
			updateHistStats(filter);
		},

		filterByDay : function(day) {
			console.log("++ selected Day " + day);
			var filter = _filterWmonth;
			if (day !== "ALL") {
				filter = filter + " AND day=" + day;
			}
			updateHistStats(filter);
		},
		clearHistory : function() {
			console.log("clearHistory called");
			var statement = "DELETE FROM " + TB_NAME;
			db_query(statement, [], db_onSuccess, db_onError);
		},
		showTab : function(id) {
			// hide all tabs first
			hideAllTabs();
			// show the tab specified
			document.getElementById(id).style.display = 'block';
		},
		doDBQuery : function(statement, items, onSuccess, onError) {
			db_query(statement, items, onSuccess, onError);
		},
		doInsertDemoData : function() {
			alert("Do you want to overwrite all currently stored data with demo data?");
			db_insertDemoData();
			updateHistStats(DEFAULTFILTER);
			db_query("SELECT DISTINCT year AS result FROM " + TB_NAME + " " + DEFAULTFILTER, [], updateYearFilter, db_onError);
		}
	}
};

