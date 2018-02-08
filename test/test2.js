// Constants: - change according to your needs
var account = 'TSTDRV1234567';
var role = 3;
var localfile = '/home/me/script1.js' // the local file to upload
var remoteFile = 'SuiteScripts/script1.js' // the path to file cabinet path to update or create. You can pass non-existing folders - in that case they will be created recursively, like mkdir -p

var nsutil = require('..');

var client = new nsutil.SuiteTalk();
var creds = nsutil.Credentials(); // ask for credentials if neccesary
client.init(creds.email, creds.password, account, role).then(() => {
    client.upload(file.path, suiteScriptPath).then(r=>{
        console.log('  Uploaded File: ' + suiteScriptPath);
    }).catch(err => {
        console.log('  Failed to Upload File: ' + err);
    });
}).catch(err => {
    console.log('  Failed to authenticate: ' + err);
});