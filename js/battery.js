// batteryMonitor

// to initilize batteryMonitor the following must be called
// batteryMonitor.init({
//		curState: "ID for Element to display current State of battery"
//		logger: "ID for Element to displaying logging info"
//		startButton: "ID for start button"
//		stopButton: "ID for stop button"
// });

var batteryMonitor = function() {
	// UNIVERSAL variables //
	// used to determine if module is being call for test suites
	var _isTesting = true;
	// DOM/UI related variables //
	// used to store Element for displaying current state
	var _currentStateElement = null;
	// used to store Element for displaying logging info
	var _loggingElement = null;
	// used to store Element for startButton
	var _startButtonElement = null;
	// used to store Element for stopButton
	var _stopButtonElement = null;
	// array of elements for GUI tabs
	var _tabsArray = [];
	// element for Year selection
	var _selectYearElement = null;
	// element for Month selection
	var _selectMonthElement = null;
	// element for Day selection
	var _selectDayElement = null;
	// element for displaying Month selection
	var _filterMonthElement = null;
	// element for displaying Day selection
	var _filterDayElement = null;
	// element for displaying total draining rate
	var _totalDrainingElement = null;
	// element for displaying total charging rate
	var _totalChargingElement = null;
	// element for displaying avg drain rate
	var _avgDrainElement = null;
	// element for displaying avg charge rate
	var _avgChargeElement = null;
	// element for displaying numer of sessions
	var _sessionNumElement = null;

	// Battery Status tracking variables
	// store current battery level
	var _curLvl = 0;
	// current state (isPlugged) [True/False]
	var _curState = null;
	// track length of level
	var _lvlTime = null;
	// track length of state
	var _stateTime = null;
	// track tracking interval
	var _startTime = null;
	// track amount of time between battery status change
	var _interval = null;
	// amount of time device has been in charging state
	var _chargeTime = 0;
	// amount of time device has been in draining state
	var _drainTime = 0;
	// total amount of charge completed
	var _chargeTotal = 0;
	// total amount of drain completed
	var _drainTotal = 0;
	// used to identify Initial Battery Level read
	// we want to ignore the initial reading as it will provide
	//incorrect calculations							*/
	var _isInitLevel = true;

	// MAGIC NUMBERS //
	// # of milliseconds in a second
	var MSINS = 1000;
	// # of seconds in an hour
	var SINH = 60 * 60;

	// Database Variables //
	var DB_NAME = "BatteryMonDB";
	var DB_VERSION = "0.1";
	var DB_DISPLAYNAME = "ShaunsApps Battery Monitor database";
	var DB_ESTSIZE = 1024 * 1024;
	var TB_NAME = "stats";
	var DEVICEPIN = null;
	var DEVICEOS = null;
	var TRACKSESSION = null;
	// used to hold database
	var _db = null;
	// used as default filter for History
	var DEFAULTFILTER = null;

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
		for ( i = 0; i < _tabsArray.length; i++) {
			document.getElementById(_tabsArray[i]).style.display = 'none';
		}
	};

	var _filterWyear = "";
	var _filterWmonth = "";

	// DATABASE FUNCTIONS //

	// Database query functions //
	// open database
	var db_open = function() {
		console.log("attempting to open database");
		_db = openDatabase(DB_NAME, DB_VERSION, DB_DISPLAYNAME, DB_ESTSIZE, function() {
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
		var db = _db;
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
		if (!_isTesting) {
			updateHistStats(DEFAULTFILTER);
			db_query(statement, [], updateYearFilter, db_onError);
		}
	};

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
		statement = 'SELECT SUM(levelchgtime) AS sum FROM ' + TB_NAME + " " + filter + " AND islevelchg=1 AND ischarging=1";
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
		var node = document.getElementById(_selectYearElement);
		updateSelectOptions(node, rs);
	};

	function updateMonthFilter(tx, rs) {
		document.getElementById(_filterMonthElement).style.display = "block";
		var node = document.getElementById(_selectMonthElement);
		updateSelectOptions(node, rs);
	};

	function updateDayFilter(tx, rs) {
		document.getElementById(_filterDayElement).style.display = "block";
		var node = document.getElementById(_selectDayElement);
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
		document.getElementById(_totalDrainingElement).innerHTML = rate + ' seconds';
	};

	function updateTotalChargeTimeStats(tx, rs) {
		var rate = 0;
		if (rs.rows.length > 0 && rs.rows.item(0).sum !== null) {
			rate = rs.rows.item(0).sum;
			rate = rate.toFixed(2);
		}
		document.getElementById(_totalChargingElement).innerHTML = rate + ' seconds';
	};

	function updateAvgDrainStats(tx, rs) {
		var rate = 0;
		var per = '';
		if (rs.rows.length > 0 && rs.rows.item(0).avg !== null) {
			rate = rs.rows.item(0).avg;
			rate = (SINH / rate).toFixed(2);
			per = "%/hour";
		}
		document.getElementById(_avgDrainElement).innerHTML = rate + per;
	};

	function updateAvgChargeStats(tx, rs) {
		var rate = 0;
		var per = '';
		if (rs.rows.length > 0 && rs.rows.item(0).avg !== null) {
			rate = rs.rows.item(0).avg;
			rate = (SINH / rate).toFixed(2);
			per = "%/hour";
		}
		document.getElementById(_avgChargeElement).innerHTML = rate + per;
	};

	function updateNumSessionStats(tx, rs) {
		var nSessions = 0;
		if (rs.rows.length > 0 && rs.rows.item(0).result !== null) {
			var nSessions = rs.rows.item(0).result;
		}
		document.getElementById(_sessionNumElement).innerHTML = nSessions;
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
		_startTime = date.getTime();
		/* start eventlisteners */
		try {
			// BB10 API
			blackberry.event.addEventListener("batterystatus", onBatteryStatusChg);
			console.log("BatteryMonitor--startListening for batterystatus");
			var date = new Date();
			if (!_isTesting) {
				document.getElementById(_loggingElement).innerHTML += getTimeStamp(date) + " starting tracking<br>";
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

			if (_curState === null) {
				// first battery status change
				_curState = info.isPlugged;
				// begin measuring battery level after this
				_curLvl = info.level;

				_interval = curTime;
				logMsg = logMsg + " inital status::Level=" + info.level + " isPlugged=" + info.isPlugged;
			} else {
				if (_curState !== info.isPlugged) {
					// Plugged in state has changed
					console.log("state changed");
					logMsg = logMsg + " state changed::Charging=" + info.isPlugged + ":: ";
					// if False track drain
					// if True track charge
					_curState = info.isPlugged;
					_curLvl = info.level;

					if (_curLvl) {
						_chargeTime += (curTime - _interval);
					} else {
						_drainTime += (curTime - _interval);
					}

				} else {
					// Battery Level changed
					// confirm level changed
					if (_curLvl === info.level) {
						console.log("**misfire: status changed yet level & charging state haven't changed: bad charging?");
						return;
					}
					console.log("battery level changed");
					logMsg = logMsg + " level changed::Level=" + info.level + ":: ";

					// stat related vars
					isLevelChg = 1;
					chgInterval = curTime - _interval;
					if (info.isPlugged) {
						// Track charge (assuming changing by 1% every time

						_chargeTime += chgInterval;
						_chargeTotal++;
						logMsg = logMsg + "charge Total:" + _chargeTotal + "\ncharge Time:" + _chargeTime;
						console.log(logMsg);

					} else {
						// Track drain
						_drainTime += chgInterval;
						;
						_drainTotal++;
						logMsg = logMsg + "drain Total:" + _drainTotal + "\ndrain Time:" + _drainTime;
						console.log(logMsg);
					}
				}
			}
			//console.log(info.isPlugged);
			//console.log(info.level);
			var drainRate = _drainTotal / _drainTime;
			// % per second
			var chargeRate = _chargeTotal / _chargeTime;
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
			document.getElementById(_currentStateElement).innerHTML = msg;

			logMsg = logMsg + "<br>";
			document.getElementById(_loggingElement).innerHTML += logMsg;

			_interval = curTime;

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
				_isTesting = false;
				_currentStateElement = uiElements.curState;
				_loggingElement = uiElements.logger;
				_startButtonElement = uiElements.startButton;
				_stopButtonElement = uiElements.stopButton;
				_tabsArray = uiElements.tabs;
				_selectYearElement = uiElements.selectYear;
				_selectMonthElement = uiElements.selectMonth;
				_selectDayElement = uiElements.selectDay;
				_filterMonthElement = uiElements.filterMonth;
				_filterDayElement = uiElements.filterDay;
				_totalDrainingElement = uiElements.totalDrain;
				_totalChargingElement = uiElements.totalCharge;
				_avgDrainElement = uiElements.avgDrain;
				_avgChargeElement = uiElements.avgCharge;
				_sessionNumElement = uiElements.sessionNum
			}
			console.log("Testing mode set to: " + _isTesting)
			db_init();
		},
		// method used to start monitoring battery
		start_monitor : function() {
			console.log("start_battery from js");
			document.getElementById(_startButtonElement).style.display = "none";
			document.getElementById(_stopButtonElement).style.display = "inline-block";
			var statement = "SELECT MAX(session) as max FROM " + TB_NAME + " WHERE pin='" + DEVICEPIN + "'";
			db_query(statement, [], determineSession, db_onError);
			BatteryMonitor_init();
		},
		// method used to stop monitoring battery
		stop_monitor : function() {
			blackberry.event.removeEventListener("batterystatus", onBatteryStatusChg);
			console.log("++BatteryMonitor--stopListening for batterystatus");
			document.getElementById(_stopButtonElement).style.display = "none";
			document.getElementById(_startButtonElement).style.display = "inline-block";
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
				document.getElementById(_filterMonthElement).style.display = "none";
				document.getElementById(_filterDayElement).style.display = "none";
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
				document.getElementById(_filterDayElement).style.display = "none";
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
			var statement = "DROP TABLE " + TB_NAME;
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
		}
	}
};

