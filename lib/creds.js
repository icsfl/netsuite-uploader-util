module.exports = (function () {
    var creds_file_name = 'netsuite_creds',
        path = require('upath');

    var creds;

    try {
        // try to load them from current directory
        creds = require('./' + creds_file_name);
        console.log('Using credentials found in ' + path.resolve(creds_file_name + '.js'));
    } catch (e) {
        try {
            // try user's home directory
            creds = require(path.join(getUserHome(), creds_file_name));
            console.log('Using credentials found in ' + path.join(getUserHome(), creds_file_name + '.js'));
        } catch (e) {
            var readline = require('readline-sync'),
                fs = require('fs');

            console.log('Provide your NetSuite Credentials');

            creds = {
                email: readline.question('Email: ', {}),
                password: readline.question('Password: ', { noEchoBack: true })
            };

            var file_name = path.join(getUserHome(), creds_file_name + '.js');

            fs.writeFile(file_name, 'module.exports = ' + JSON.stringify(creds), function () {
                console.log('NetSuite credentials have been stored in ' + file_name);
            });
        }
    }

    return creds;

    function getUserHome() {
        return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    }
})();