var db = requireMain("./utils/database");
var sessionid = requireMain("./utils/sessionid");

exports.createSession = function(userid, username, ip, useragent, cb) {
	var id = sessionid(username);

	db.query("INSERT INTO sessions (id,userid,username,ip,useragent) VALUES (?,?,?,?,?)", [id, userid, username, ip, useragent], function(err, result) {
		cb(err, id);
	});
}

exports.removeSession = function(id, cb) {
	db.query("UPDATE sessions SET active=0 WHERE id=?", [id], function(err, result) {
		cb(err, id);
	});
}

exports.createAdminSession = function(userid, username, ip, useragent, cb) {
	var id = sessionid(username);

	db.query("INSERT INTO admin_sessions (id,userid,username,ip,useragent) VALUES (?,?,?,?,?)", [id, userid, username, ip, useragent], function(err, result) {
		cb(err, id);
	});
}

exports.removeAdminSession = function(id, cb) {
	db.query("UPDATE admin_sessions SET active=0 WHERE id=?", [id], function(err, result) {
		cb(err, id);
	});
}