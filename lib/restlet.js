module.exports = (function(){
	var http = require('https'),
		Q = require('q');

	return new Restlet();

	function Restlet(){
		var dataCenters = {};

		this.getDataCenter = function(email, password, account, role){
			var deferred = Q.defer();

			var key = [account, role].join('|').toUpperCase();
			if(dataCenters[key]){
				deferred.resolve(dataCenters[key]);
			} else {
				console.log('Loading Data Centers...');
				var options = {
					hostname: 'rest.netsuite.com',
					port: 443,
					path: '/rest/roles',
					method: 'GET',
					headers: {
						'Authorization': 'NLAuth nlauth_email='+email+', nlauth_signature='+password,
						'Accept': 'application/json'
					}
				};

				var req = http.request(options, function(res){
					var body = '';
					res.on('data', function(chunk) {
						body += chunk;
					});
					res.on('end', function(){
						if(res.statusCode == 200){
							var dataCenters = JSON.parse(body);

							dataCenters.forEach(function(dc){ 
								var _key = [dc.account.internalId, dc.role.internalId].join('|').toUpperCase();
								dataCenters[_key] = dc;
							});

							deferred.resolve(dataCenters[key]);
						} else {
							deferred.reject(JSON.parse(body));
						}
					});
					res.on('error', function(e){
						deferred.reject({ error: { code: "UNKNOWN", message: e }});
					});
				});

				req.end();
			}
			return deferred.promise;
		}
	}
})();