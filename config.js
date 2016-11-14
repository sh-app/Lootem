exports.port = 8000;

exports.selfUrl = process.env.SELF_URL || "http://btc.vsakos.com";

exports.mysql = {
	user: "btcgame",
	password: "btcgame",
	host: "srv.vsakos.com",
	database: "btcgame",
	connectionLimit: 10,
	charset: "utf8mb4"
}

exports.env = "development";
//exports.env = "production";