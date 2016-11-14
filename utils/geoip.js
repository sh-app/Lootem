var maxmind = requireMain("maxmind");

var lookup = maxmind.open(__dirname + "/../dependencies/geoip/country.mmdb", {
	cache: {
		max: 0,
		maxAge: 0
	}
});

module.exports = function(ip) {
	return lookup.get(ip);
}