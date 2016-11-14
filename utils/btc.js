var blockchain = requireMain("blockchain.info");
var db = requireMain("./utils/database");
var config = requireMain("./config");
var settings = requireMain("./utils/settings");
var coinkey = requireMain("coinkey");
var secp256k1 = requireMain("secp256k1");

var blockcy = requireMain("blockcypher");
var blockcypher = new blockcy("btc", "test3", "51c561a1a9ed46ffbf38d356cb409078");


exports.latestBlock = function(callback) {
	blockchain.blockexplorer.getLatestBlock().then(function(result) {
		callback(null, result);
	}, function(error) {
		callback(error, null);
	});
}


exports.createDepositAddress = function(callback) {
	settings.getDepositAddress(function(err, result) {
		blockcypher.createPayFwd({
			destination: result,
			callback_url: config.selfUrl + "/callbacks/blockcypher/z7824btrz/payment"
		}, function(err, body) {
			if(err)
				callback(err, {});
			else {
				blockcypher.createHook({
					event: "confirmed-tx",
					address: body["input_address"],
					url: config.selfUrl + "/callbacks/blockcypher/z7824btrz/confirmation"
				}, function(err, bodyy) {
					if(err)
						callback(err, {});
					else
						callback(null, {
							forwardid: body["id"],
							hookid: bodyy["id"],
							address: body["input_address"]
						});
				});
			}
			
		});
	});
}


exports.removeDepositAddress = function(addressid, hookid) {
	blockcypher.delPayFwd(addressid);
	blockcypher.delHook(hookid);
}


exports.withdraw = function(to, amount, callback) {
	settings.getWithdrawAddressAndPrivateKey(function(err, from, privatekey) {
		if(err) {
			callback(err, null);
			return;
		}

		blockcypher.newTX({
			inputs: [
				{
					addresses: [from]
				}
			],
			outputs: [
				{
					addresses: [to],
					value: amount
				}
			]
		}, function(err, result) {
			if(err) {
				callback(err, null);
				return;
			}

			if(result.error || result.errors) {
				callback(result.error || result.errors[0].error, null);
				return;
			}

			var key = coinkey.fromWif(privatekey);

			result.signatures = [];

			result.pubkeys = [];

			result.tosign.forEach(function(item) {
				var signed = secp256k1.sign(new Buffer(item, "hex"), key.privateKey);
				result.signatures.push(secp256k1.signatureExport(signed.signature).toString("hex"));
				result.pubkeys.push(key.publicKey.toString("hex"));
			});

			
			
			blockcypher.sendTX(result, function(err, result) {
				if(err) {
					callback(err, null);
					return;
				}

				if(result.error || result.errors) {
					callback(result.error || result.errors[0].error, null);
					return;
				}

				callback(null, result);
			});
		});
	});
}



