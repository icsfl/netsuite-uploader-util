module.exports = (function(){

	var Q = require('q'),
		https = require('https'),
		restlet = require('./restlet'),
		path = require('path'),
		format = require('string-template'),
		fs = require('fs');

	var folder_cache = {};

	return SuiteTalk;

	function SuiteTalk(){ 
		var self = this;

		// Properties
		self.email = '';
		self.password = '';
		self.account = '';
		self.role = '';
		self.hostname = '';

		// Behaviors
		self.init = init;
		self.upload = upload;

		// Public Implementations:
		function init(email, password, account, role){
			if(!email)
				throw 'email is required';
			if(!password)
				throw 'password is required';
			if(!account)
				throw 'account is required';
			if(!role)
				throw 'role is required';
			self.email = email;
			self.password = password;
			self.account = account;
			self.role = role;

			var deferred = Q.defer();
			
			if(self.hostname){
				deferred.resolve();
			} else {
				restlet.getDataCenter(email, password, account, role).then(function(dataCenter){
					self.hostname = path.basename(dataCenter.dataCenterURLs.webservicesDomain);
					deferred.resolve();
				});
			}

			return deferred.promise;
		}

		function upload(target, dest){
			if(!self.hostname)
				throw 'Must call init first';

			return getParentFolderId(dest).then(function(parent){
				var name = dest.split('/').pop();
				uploadFile(parent, name, target);
			});

			function getParentFolderId(dest){
				var deferred = Q.defer();

				var dest_parts = dest.split('/').filter(function(p){ return p });
				function step(parent){
					if(dest_parts.length == 1){
						deferred.resolve(parent);
					} else {
						getFolderId(parent, dest_parts.shift()).then(step);
					}
				}
				step();

				return deferred.promise;
			}
		}

		// Private Implementations:

		function formatXML(xmltemplate, fields){
			var params = {
				email: self.email,
				password: self.password,
				account: self.account,
				role: self.role
			};
			for(var i in fields){
				params[i] = fields[i];
			}
			return format(xmltemplate, params);
		}

		function POST(body, soapAction){
			var deferred = Q.defer();

			var options = {
				hostname: self.hostname,
				port: 443,
				path: '/services/NetSuitePort_2014_2',
				method: 'POST',
				headers: {
					'Content-Type': 'text/xml; charset=utf-8'
				}
			};

			if(soapAction){
				options.headers['SOAPAction'] = soapAction;
			}

			var req = https.request(options, function(res){
				var res_body = '';
				res.on('data', function(chunk){ res_body += chunk; });
				res.on('end', function(){
					//console.log('RECEIVED: \r\n' + res_body);
					deferred.resolve(res_body);
				});
				res.on('error', function(e){
					//console.log('FAILED: ' + e);
					deferred.reject(e);
				});
			});
			//console.log('SENDING: \r\n' + body);
			req.write(body);
			req.end();
			return deferred.promise;
		}

		function uploadFile(parent, name, target){
			parent = parent || '@NONE@';

			return getFileId(parent, name).then(function(fileid){
				var xmlAdd =    '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><email xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_2014_2.platform.webservices.netsuite.com" /></passport></soap:Header><soap:Body><add xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><record xmlns:q1="urn:filecabinet_2014_2.documents.webservices.netsuite.com" xsi:type="q1:File" internalId=""><q1:name>{filename}</q1:name><q1:content>{content}</q1:content><q1:folder internalId="{parent}" type="folder" /></record></add></soap:Body></soap:Envelope>';
				var xmlUpdate = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><email xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_2014_2.platform.webservices.netsuite.com" /></passport></soap:Header><soap:Body><update xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><record xmlns:q1="urn:filecabinet_2014_2.documents.webservices.netsuite.com" xsi:type="q1:File" internalId="{fileid}"><q1:content>{content}</q1:content></record></update></soap:Body></soap:Envelope>';
				readFileContents(target).then(function(content){
					var xml = formatXML(fileid ? xmlUpdate : xmlAdd,
					{
						filename: name,
						fileid: fileid,
						parent: parent,
						content: content
					});
					return POST(xml, fileid ? 'update' : 'add').then(function(){
						var verb = fileid ? 'Updated ' : 'Added ';
						console.log(verb + 'file: ' + name);
					});
				});
			});

			function getFileId(parent, name){
				var xml = formatXML('<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><email xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_2014_2.platform.webservices.netsuite.com" /></passport></soap:Header><soap:Body><search xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><searchRecord xmlns:q1="urn:filecabinet_2014_2.documents.webservices.netsuite.com" xsi:type="q1:FileSearchAdvanced"><q1:criteria><q1:basic><folder operator="anyOf" xmlns="urn:common_2014_2.platform.webservices.netsuite.com"><searchValue internalId="{parent}" type="folder" xmlns="urn:core_2014_2.platform.webservices.netsuite.com" /></folder><name operator="is" xmlns="urn:common_2014_2.platform.webservices.netsuite.com"><searchValue xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{filename}</searchValue></name></q1:basic></q1:criteria><q1:columns><q1:basic><internalId xmlns="urn:common_2014_2.platform.webservices.netsuite.com" /></q1:basic></q1:columns></searchRecord></search></soap:Body></soap:Envelope>',
				{
					filename: name,
					parent: parent
				});
				return POST(xml, 'search').then(function(data){
					if(getTotalRecords(data) > 0){
						var matches = data.match(/<platformCore:searchValue internalId="(.*?)"\/>/);
						if(matches != null){
							var id = parseInt(matches[1]);
							return id;
						}
					}
					return undefined;
				});
			}

			function readFileContents(target){
				var deferred = Q.defer();
				fs.readFile(target, function(err, data){
					var contents = new Buffer(data).toString('base64');
					deferred.resolve(contents);
				});
				return deferred.promise;
			}
		}

		function getFolderId(parent, foldername){
			var key = parent+'|'+foldername.toLowerCase();

			if(folder_cache[key]){
				var deferred = Q.defer();
				deferred.resolve(folder_cache[key]);
				return deferred.promise;
			}

			var xml = formatXML('<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><email xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_2014_2.platform.webservices.netsuite.com" /></passport></soap:Header><soap:Body><search xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><searchRecord xmlns:q1="urn:filecabinet_2014_2.documents.webservices.netsuite.com" xsi:type="q1:FolderSearch"><q1:basic><name operator="is" xmlns="urn:common_2014_2.platform.webservices.netsuite.com"><searchValue xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{foldername}</searchValue></name><parent operator="anyOf" xmlns="urn:common_2014_2.platform.webservices.netsuite.com"><searchValue internalId="{parent}" type="folder" xmlns="urn:core_2014_2.platform.webservices.netsuite.com" /></parent></q1:basic></searchRecord></search></soap:Body></soap:Envelope>',
				{
					foldername: foldername,
					parent: parent || '@NONE@'
				});

			return POST(xml, 'search').then(function(data){
				var totalRecords = getTotalRecords(data);
				if(totalRecords > 0){
					var matches = data.match(/internalId="(.*?)"/);
					if(matches != null){
						var id = parseInt(matches[1]);
						folder_cache[key] = id;
						return id;
					} else {
						throw 'ERR';
					}
				} else {
					var xmlWithParent =   '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><email xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_2014_2.platform.webservices.netsuite.com" /></passport></soap:Header><soap:Body><add xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><record xmlns:q1="urn:filecabinet_2014_2.documents.webservices.netsuite.com" xsi:type="q1:Folder"><q1:name>{foldername}</q1:name><q1:parent internalId="{parent}" type="folder" /></record></add></soap:Body></soap:Envelope>';
					var xmlWithNoParent = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><passport xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><email xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{email}</email><password xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{password}</password><account xmlns="urn:core_2014_2.platform.webservices.netsuite.com">{account}</account><role internalId="{role}" xmlns="urn:core_2014_2.platform.webservices.netsuite.com" /></passport></soap:Header><soap:Body><add xmlns="urn:messages_2014_2.platform.webservices.netsuite.com"><record xmlns:q1="urn:filecabinet_2014_2.documents.webservices.netsuite.com" xsi:type="q1:Folder"><q1:name>{foldername}</q1:name></record></add></soap:Body></soap:Envelope>';

					var create_xml = formatXML(parent ? xmlWithParent : xmlWithNoParent,
						{
							foldername: foldername,
							parent: parent || '@NONE@'
						});
					
					console.log('Creating Folder: ' + foldername + ' Parent: ' + parent);
					return POST(create_xml, 'add').then(function(data){
						var matches = data.match(/internalId="(.*?)"/);
						if(matches != null){
							var id = parseInt(matches[1]);
							folder_cache[key] = id;
							return id;
						} else {
							throw 'ERR';
						}
					});
				}
			});
		};

		function getTotalRecords(body){
			var matches = body.match(/<platformCore:totalRecords>(.*?)<\/platformCore:totalRecords>/);
			if(matches != null){
				return parseInt(matches[1]);	
			} else {
				return 0;
			}
		}

		function validateRequiredFields(params, field_names){
			for(var i in field_names){
				var field_name = field_names[i];
				if(!params[field_name])
					throw field_name + ' is required';
			}
		}
	}
})();