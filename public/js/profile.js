$("#generate-deposit-button").click(function() {
	$("#deposit-info").slideUp("fast");

	$.post("/ajax/createdepositaddr", {}, "json")
	.done(function(result) {
		$("#deposit-address").text(result.address);
		$("#deposit-address-holder").slideDown("fast");
	});
});


$("#withdraw-form").submit(function() {
	var data = {
		address: $("#withdraw-form-address").val(),
		amount: $("#withdraw-form-amount").val()
	}

	$("#withdraw-error").slideUp("fast");
	$("#withdraw-success").slideUp("fast");

	$.post("/ajax/withdraw", data, "json")
	.done(function(result) {
		$("#withdraw-success").text(result.message).slideDown("fast");
		$("#withdraw-form-amount").val("");
	})
	.fail(function(result) {
		if(result.responseJSON.error)
			$("#withdraw-error").text(result.responseJSON.error).slideDown("fast");
	});

	return false;
});

socket.on("balance-changed", function(balance) {
	$("#current-balance").text(balance);
	$("#balance-holder").flashText();
});

socket.on("new-tx", function(tx) {
	nunjucks.render("tx.html", {tx: tx}, function(err, res) {
		if(err) {
			console.log(err);
			return;
		}

		var elem = $(res);
		$("#transaction-header").after(elem);
		elem.flashBackground();

		var notx = $("#notx");
		if(notx.length > 0)
			notx.remove();
	});
});

socket.on("tx-status-changed", function(tx) {
	nunjucks.render("tx.html", {tx: tx}, function(err, res) {
		if(err) {
			console.log(err);
			return;
		}
		var elem = $(res);
		$('.transaction-item[data-txid="' + tx.id + '"]').replaceWith(elem);
		elem.flashBackground();
	});
	
});