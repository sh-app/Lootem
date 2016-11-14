module.exports = function(req, res, next) {

	var flashData = [];

	if(req.cookies.flash) {
		flashData = req.cookies.flash;
	}

	req.flash = res.flash = function(type, message) {
		flashData.push({
			type: type,
			message: message
		});
		res.cookie("flash", flashData);
	}

	res.locals.flash = function() {
		res.clearCookie("flash");
		var temp = flashData.slice();
		flashData = [];
		return temp;
	}

	next();

}