var db = requireMain("./utils/database");
var crypto = requireMain("crypto");
var async = requireMain("async");

/**
 *
 * 	USE THIS KEY FOR DECODING SETTINGS
 * 
 */
var aes_key = "v35$1q&g2u/n@c2tF(7gE+4!5}hg]|+T";


function _enc(text, encoding) {
	var e = encoding || "utf8";
	aes = crypto.createCipher("aes-256-cbc", aes_key);
	return aes.update(text, e, "hex") + aes.final("hex");
}

function _dec(text, encoding) {
	var e = encoding || "utf8";
	aes = crypto.createDecipher("aes-256-cbc", aes_key);
	return aes.update(text, "hex", e) + aes.final(e);
}


function _get(key, callback) {
	db.query("SELECT svalue, senc FROM settings WHERE skey=?", [key], function(err, result) {
		if(err) {
			callback(err, null);
			return;
		}

		if(result[0].senc == 0) {
			callback(null, result[0].svalue);
		}
		else {
			callback(null, _dec(result[0].svalue));
		}
	});
}

function _set(key, value, callback) {
	db.query("SELECT senc FROM settings WHERE skey=?", [key], function(err, result) {
		if(err) {
			callback(err, null);
			return;
		}

		db.query("UPDATE settings SET svalue=? WHERE skey=?", [(result[0].senc==0) ? value : _enc(value), key], function(err, result) {
			if(err) {
				callback(err, null);
				return;
			}

			callback(null, value);
		});
	});
}

function _getAll(callback) {
	db.query("SELECT * FROM settings", function(err, result) {
		if(err) {
			callback(err, null);
			return;
		}

		var settings = {};

		result.forEach(function(value) {
			if(value.senc == 0)
				settings[value.skey] = value.svalue;
			else
				settings[value.skey] = _dec(value.svalue);
		});

		callback(null, settings);
	});
}

exports.getDepositAddress = function(callback) {
	_get("deposit_address", callback);
}

exports.setDepositAddress = function(address, callback) {
	_set("deposit_address", address, callback);
}

exports.getWithdrawAddress = function(callback) {
	_get("withdraw_address", callback);
}

exports.setWithdrawAddress = function(address, callback) {
	_set("withdraw_address", address, callback);
}

exports.getWithdrawPrivateKey = function(callback) {
	_get("withdraw_privatekey", callback);
}

exports.setWithdrawPrivateKey = function(key, callback) {
	_set("withdraw_privatekey", key, callback);
}

exports.getDailyWithdrawLimit = function(callback) {
	_get("withdraw_per_day", callback);
}

exports.setDailyWithdrawLimit = function(limit, callback) {
	_set("withdraw_per_day", limit, callback);
}

exports.getWithdrawMin = function(callback) {
	_get("withdraw_min", callback);
}

exports.setWithdrawMin = function(limit, callback) {
	_set("withdraw_min", limit, callback);
}

exports.getWithdrawMax = function(callback) {
	_get("withdraw_max", callback);
}

exports.setWithdrawMax = function(limit, callback) {
	_set("withdraw_max", limit, callback);
}

exports.getWithdrawAddressAndPrivateKey = function(callback) {	// callback(error, address, privatekey)
	async.parallel([
		exports.getWithdrawAddress,
		exports.getWithdrawPrivateKey
	], function(err, results) {
		if(err)
			callback(err, null, null);
		else
			callback(null, results[0], results[1]);
	});
}

exports.getAll = _getAll;
