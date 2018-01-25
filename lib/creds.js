const creds_file_name = 'netsuite_creds'; 
const path = require('upath');
const log = require('./util').log; 
const getUserHome = require('./util').getUserHome

let creds; 

function credentials() {
    try {
        // try to load them from current directory
        creds = require('./' + creds_file_name);
        log('Using credentials found in ' + path.resolve(creds_file_name + '.js'));
    } catch (e) {
        try {
            // try user's home directory
            creds = require(path.join(getUserHome(), creds_file_name));
            log('Using credentials found in ' + path.join(getUserHome(), creds_file_name + '.js'));
        } catch (e) {
            var readline = require('readline-sync'),
                fs = require('fs');

            log('Provide your NetSuite Credentials');

            creds = {
                email: readline.question('Email: ', {}),
                password: readline.question('Password: ', { noEchoBack: true })
            };

            var file_name = path.join(getUserHome(), creds_file_name + '.js');

            fs.writeFile(file_name, 'module.exports = ' + JSON.stringify(creds), function () {
                log('NetSuite credentials have been stored in ' + file_name);
            });
        }
    }
    return creds;
}

module.exports = {credentials}; 