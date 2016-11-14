var db = requireMain("./utils/database");
var crypto = requireMain("crypto");

function generateSignature(id, username, password, expires) {
	var hash = crypto.createHash("sha256");
	hash.update("igo4w" + id + "c59n8.4g4w-g4w+" + username + "j4zeQW,-3RQ" + password + ",x3-.nx,z.-bnx34" + expires + "564wv3-3.,r");
	return hash.digest("hex");
}

exports.generateToken = function(userid, cb) {

	db.query("SELECT * FROM users WHERE id=?", [userid], function(err, result) {

		if(err) {
			cb(err, null);
			return;
		}

		if(result.length < 1) {
			cb("invaliduser", null);
			return;
		}

		var row = result[0];
		var id = row["id"];
		var username = row["username"];
		var password = row["password"];
		var expires = Date.now() + 43200000;
		var signature = generateSignature(id, username, password, expires);

		var token = id + "-" + expires + "-" + signature;

		cb(null, token);
	});

}

exports.verifyToken = function(token, cb) {
	if(typeof token != "string") {
		cb(null, false);
		return;
	}

	var parts = token.split("-");

	if(parts.length != 3) {
		cb(null, false);
		return;
	}

	var id = parseInt(parts[0]);
	var ex = parseInt(parts[1]);

	if((id == NaN) || (ex == NaN)) {
		cb(null, false);
		return;
	}

	if(ex < Date.now()) {
		cb(null, false);
		return;
	}

	db.query("SELECT * FROM users WHERE id=?", [id], function(err, result) {

		if(err) {
			cb(err, null);
			return;
		}

		if(result.length < 1) {
			cb(null, false);
			return;
		}

		var row = result[0];

		var id = row["id"];
		var username = row["username"];
		var password = row["password"];

		var signature = generateSignature(id, username, password, ex);

		if(parts[2] == signature) {
			cb(null, true);
		}
		else {
			cb(null, false);
		}

	});
}

