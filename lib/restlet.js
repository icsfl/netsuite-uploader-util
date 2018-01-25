const log = require('./util').log;
const http = require('https')

let dataCenters = {};

function getDataCenter(email, password, account, role) {
	return new Promise((resolve, reject) => {
		let key = [account, role].join('|').toUpperCase();

		if(dataCenters[key]){
			resolve(dataCenters[key]);
		} else {
			log('Loading Data Centers...');
			let options = {
				hostname: 'rest.netsuite.com',
				port: 443,
				path: '/rest/roles',
				method: 'GET',
				headers: {
					'Authorization': 'NLAuth nlauth_email='+email+', nlauth_signature='+password,
					'Accept': 'application/json'
				}
			};

			const req = http.request(options, res => {
				let body = '';
				res.on('data', chunk => {
					body += chunk;
				});
				res.on('end', () => {
					if(res.statusCode == 200){
						let dataCenters = JSON.parse(body);

						dataCenters.forEach(dc => { 
							let _key = [dc.account.internalId, dc.role.internalId].join('|').toUpperCase();
							dataCenters[_key] = dc;
						});

						resolve(dataCenters[key]);
					} else {
						reject(JSON.parse(body));
					}
				});
				res.on('error', e => {
					reject({ error: { code: "UNKNOWN", message: e }});
				});
			});

			req.end();
		}
	});
}
module.exports = {getDataCenter}