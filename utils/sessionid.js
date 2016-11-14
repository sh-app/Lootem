var crypto = requireMain("crypto");
var uuid = requireMain("node-uuid");

module.exports = function(seed) {
	var hash = crypto.createHash("sha1");
	hash.update(seed);
	var sha1 = hash.digest("hex");

	return sha1.substring(0,13) + "-" + uuid.v4();
}