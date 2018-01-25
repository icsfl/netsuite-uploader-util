const https = require('https'); 
const restlet = require('./restlet'); 
const path = require('path'); 
const format = require('string-template'); 
const fs = require('fs');
const log = require('./util').log; 
const readFileContents = require('./util').readFileContents


let folder_cache = {};

function SuiteTalk() {
	let self = this;

	self.nsVersionLatestKnown = '2017_2'

	// Properties
	self.email = '';
	self.password = '';
	self.account = '';
	self.role = '';
	self.hostname = '';


	// Behaviors
	self.init = init;
	self.upload = upload;

	/**
	 * @typedef {Object} Options
	 * 
	 * @property {String} password 
	 * @property {String} account 
	 * @property {String} role 
	 * @property {String} applicationId 
	 * @property {String} nsVersion something like '2017_2'. If you use 2015_2 or later you could also need to indicate an application id. If omitted and no applicationId is passed 2015_1 is used;  otherwise the latest known that currently is 2017_2
	 */

	// Public Implementations:
	/**
	 * @param {String|Options} email 
	 * @param {String} password 
	 * @param {String} account 
	 * @param {String} role 
	 * @param {String} applicationId 
	 * @param {String} nsVersion something like '2017_2'. If you use 2015_2 or later you could also need to indicate an application id. If omitted and no applicationId is passed 2015_1 is used;  otherwise the latest known that currently is 2017_2
	 */
	function init(email, password, account, role, applicationId, nsVersion) {
		if(arguments.length==1 && typeof email == 'object'){
			let options = email;
			email = options.applicationIdemail; 
			password = options.applicationIdpassword; 
			account = options.applicationIdaccount; 
			role = options.applicationIdrole; 
			applicationId = options.applicationIdapplicationId; 
			nsVersion = options.applicationIdnsVersion; 
		}
		if (!email)
			throw 'email is required';
		if (!password)
			throw 'password is required';
		if (!account)
			throw 'account is required';
		if (!role)
			throw 'role is required';
		self.email = email;
		self.password = password;
		self.account = account;
		self.role = role;

		if (self.applicationId && !nsVersion) {
			nsVersion = self.nsVersionLatestKnown
		}
		self.nsVersion = nsVersion || '2015_1';

		let nsVersionLaterThan2015_2 = parseInt(self.nsVersion.replace('_', '.'), 10) > 2015.19;

		self.applicationId = applicationId;
		if (nsVersionLaterThan2015_2 && !self.applicationId) {
			log('WARNING - using suitetalk greater than 2015_2 requires that you also provide an applicationId which you didn\'t');
		}

		self.globalApplicationIdFragment = self.applicationId ? `<applicationInfo xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><applicationId xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">${applicationId}</applicationId></applicationInfo>` : ``;

		if(self.hostname){
			return Promise.resolve();
		}
		else{
			return restlet.getDataCenter(email, password, account, role).then(dataCenter => {
				self.hostname = path.basename(dataCenter.dataCenterURLs.webservicesDomain);
			});
		}
	}

	function upload(target, dest) {
		if (!self.hostname)
			throw 'Must call init first';

		return getParentFolderId(dest).then(parent => {
			var name = dest.split('/').pop();
			return uploadFile(parent, name, target);
		});

		function getParentFolderId(dest) {
			return new Promise((resolve, reject)=>{
				var dest_parts = dest.split('/').filter(p => { return p });
				function step(parent) {
					if (dest_parts.length == 1) {
						resolve(parent);
					} else {
						getFolderId(parent, dest_parts.shift())
						.then(step)
						.catch((ex) => { 
							log('getFolderId', ex); 
							reject(ex) 
						});
					}
				}
				step();
			});
		}
	}

	// Private Implementations:

	function formatXML(xmltemplate, fields) {
		var params = {
			email: self.email,
			password: self.password,
			account: self.account,
			role: self.role
		};
		for (var i in fields) {
			params[i] = fields[i];
		}
		return format(xmltemplate, params);
	}

	function POST(body, soapAction) {
		return new Promise((resolve, reject)=>{
			let options = {
				hostname: self.hostname,
				port: 443,
				path: `/services/NetSuitePort_${self.nsVersion}`,
				method: 'POST',
				headers: {
					'Content-Type': 'text/xml; charset=utf-8'
				}
			};
			if (soapAction) {
				options.headers['SOAPAction'] = soapAction;
			}

			var req = https.request(options,  res => {
				var res_body = '';
				res.on('data', chunk => { res_body += chunk; });
				res.on('end', () => {
					// log('RECEIVED: \r\n' + res_body);
					var matches = /isSuccess="(.*?)"/.exec(res_body);
					if (matches) {
						var result = matches[1];
						if (result == "false") {
							var err = /<platformCore:message>([\s|\S]*?)<\/platformCore:message>/.exec(res_body)[1];
							reject(err);
						} else {
							resolve(res_body);
						}
					} else {
						matches = /<platformFaults:message>([\s|\S]*?)<\/platformFaults:message>/.exec(res_body);
						if (matches) {
							reject(matches[1]);
						} else {
							reject('Unknown Error: ' + res_body);
						}
					}
				});
				res.on('error', e => {
					//log('FAILED: ' + e);
					reject(e);
				});
			});
			//log('SENDING: \r\n' + body);
			req.write(body);
			req.end();
		})

	}

	function uploadFile(parent, name, target) {
		parent = parent || '@NONE@';

		return getFileId(parent, name).then(function (fileid) {
			var xmlAdd = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><email xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com" /></passport>${self.globalApplicationIdFragment}</soap:Header><soap:Body><add xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><record xmlns:q1="urn:filecabinet_${self.nsVersion}.documents.webservices.netsuite.com" xsi:type="q1:File" internalId=""><q1:name>{filename}</q1:name><q1:content>{content}</q1:content><q1:folder internalId="{parent}" type="folder" /></record></add></soap:Body></soap:Envelope>`;
			var xmlUpdate = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><email xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com" /></passport>${self.globalApplicationIdFragment}</soap:Header><soap:Body><update xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><record xmlns:q1="urn:filecabinet_${self.nsVersion}.documents.webservices.netsuite.com" xsi:type="q1:File" internalId="{fileid}"><q1:content>{content}</q1:content></record></update></soap:Body></soap:Envelope>`;
			return readFileContents(target)
			.then(function (content) {
				var xml = formatXML(fileid ? xmlUpdate : xmlAdd,
					{
						filename: name,
						fileid: fileid,
						parent: parent,
						content: content
					});
				return POST(xml, fileid ? 'update' : 'add').then( () => {
					var verb = fileid ? 'Updated ' : 'Added ';
					log(verb + 'file: ' + name);
				});
			}).catch(ex => { log('readFileContents', ex) ; return Promise.reject(ex); });
		}).catch(ex => { log('getFileId', ex); return Promise.reject(ex); });

		function getFileId(parent, name) {
			var xml = formatXML(`<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><email xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com" /></passport>${self.globalApplicationIdFragment}</soap:Header><soap:Body><search xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><searchRecord xmlns:q1="urn:filecabinet_${self.nsVersion}.documents.webservices.netsuite.com" xsi:type="q1:FileSearchAdvanced"><q1:criteria><q1:basic><folder operator="anyOf" xmlns="urn:common_${self.nsVersion}.platform.webservices.netsuite.com"><searchValue internalId="{parent}" type="folder" xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com" /></folder><name operator="is" xmlns="urn:common_${self.nsVersion}.platform.webservices.netsuite.com"><searchValue xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{filename}</searchValue></name></q1:basic></q1:criteria><q1:columns><q1:basic><internalId xmlns="urn:common_${self.nsVersion}.platform.webservices.netsuite.com" /></q1:basic></q1:columns></searchRecord></search></soap:Body></soap:Envelope>`,
				{
					filename: name,
					parent: parent
				});
			return POST(xml, 'search').then( data => {
				if (getTotalRecords(data) > 0) {
					var matches = data.match(/<platformCore:searchValue internalId="(.*?)"\/>/);
					if (matches != null) {
						var id = parseInt(matches[1]);
						return id;
					}
				}
			});
		}
	}

	function getFolderId(parent, foldername) {
		let key = parent + '|' + foldername.toLowerCase();

		if (folder_cache[key]) {
			return Promise.resolve(folder_cache[key]); 
		}

		let xml = formatXML(`<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><email xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com" /></passport>${self.globalApplicationIdFragment}</soap:Header><soap:Body><search xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><searchRecord xmlns:q1="urn:filecabinet_${self.nsVersion}.documents.webservices.netsuite.com" xsi:type="q1:FolderSearch"><q1:basic><name operator="is" xmlns="urn:common_${self.nsVersion}.platform.webservices.netsuite.com"><searchValue xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{foldername}</searchValue></name><parent operator="anyOf" xmlns="urn:common_${self.nsVersion}.platform.webservices.netsuite.com"><searchValue internalId="{parent}" type="folder" xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com" /></parent></q1:basic></searchRecord></search></soap:Body></soap:Envelope>`,
			{
				foldername: foldername,
				parent: parent || '@NONE@'
			});

		return POST(xml, 'search').then( data => {
			let totalRecords = getTotalRecords(data);
			if (totalRecords > 0) {
				let matches = data.match(/internalId="(.*?)"/);
				if (matches != null) {
					let id = parseInt(matches[1]);
					folder_cache[key] = id;
					return id;
				} else {
					throw 'ERR';
				}
			} else {
				let xmlWithParent = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><email xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com" /></passport>${self.globalApplicationIdFragment}</soap:Header><soap:Body><add xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><record xmlns:q1="urn:filecabinet_${self.nsVersion}.documents.webservices.netsuite.com" xsi:type="q1:Folder"><q1:name>{foldername}</q1:name><q1:parent internalId="{parent}" type="folder" /></record></add></soap:Body></soap:Envelope>`;
				let xmlWithNoParent = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><email xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_${self.nsVersion}.platform.webservices.netsuite.com" /></passport>${self.globalApplicationIdFragment}</soap:Header><soap:Body><add xmlns="urn:messages_${self.nsVersion}.platform.webservices.netsuite.com"><record xmlns:q1="urn:filecabinet_${self.nsVersion}.documents.webservices.netsuite.com" xsi:type="q1:Folder"><q1:name>{foldername}</q1:name></record></add></soap:Body></soap:Envelope>`;

				let create_xml = formatXML(parent ? xmlWithParent : xmlWithNoParent,
					{
						foldername: foldername,
						parent: parent || '@NONE@'
					});

				log('Creating Folder: ' + foldername + ' Parent: ' + parent);
				return POST(create_xml, 'add').then( data => {
					let matches = data.match(/internalId="(.*?)"/);
					if (matches != null) {
						let id = parseInt(matches[1]);
						folder_cache[key] = id;
						return id;
					} else {
						throw 'ERR';
					}
				}).catch(ex => { log('POST-add', ex); return Promise.reject(ex);  });
			}
		}).catch(ex => { log('search', ex); return Promise.reject(ex);  });
	}

	function getTotalRecords(body) {
		let matches = body.match(/<platformCore:totalRecords>(.*?)<\/platformCore:totalRecords>/);
		if (matches != null) {
			return parseInt(matches[1]);
		} else {
			return 0;
		}
	}
}

module.exports = SuiteTalk;