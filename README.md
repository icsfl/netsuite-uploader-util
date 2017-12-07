[![devDependencies Status](https://david-dm.org/cancerberosgx/netsuite-uploader-util/status.svg)](https://david-dm.org/cancerberosgx/netsuite-uploader-util)

# netsuite-uploader-util

Helper library for uploading files from your local computer into the NetSuite File Cabinet from nodejs.

# Install

```
 $ npm install netsuite-uploader-util 
```

# Usage

Simple using SuiteTalk 2015_1 so you dont need application ID: 

```javascript
// Constants: - change according to your needs
var account = 'TSTDRV1234567';
var role = 3;
var localfile = '/home/me/script1.js' // the local file to upload
var remoteFile = 'SuiteScripts/script1.js' // the path to file cabinet path to update or create. You can pass non-existing folders - in that case they will be created recursively, like mkdir -p

var nsutil = require('netsuite-uploader-util');

var client = new nsutil.SuiteTalk();
var creds = nsutil.Credentials;
client.init(creds.email, creds.password, account, role).then(() => {
    client.upload(file.path, suiteScriptPath).then(r=>{
            console.log('  Uploaded File: ' + suiteScriptPath);
        }, err => {
            console.log('  Failed to Upload File: ' + err);
        });
    });
});

```

Or you can use latest SuiteTalk versions, currently 2017_2. For this you need an application ID which you can create in Setup->Integration->Manage Integrations menu. Is the same as before but we pass extra two parameters to client.init(). `nsVersion` parameter is optional. Example: 

```javascript
var applicationId = 'E296719E-C000-4719-B60A-89B72FB65E88';
var nsVersion = '2017_2';
client.init(creds.email, creds.password, account, role, applicationId, nsVersion)....
```

# Sample gulpfile.js task that leverages this utility:

```javascript
var gulp = require('gulp'),
    watch = require('gulp-watch'),
    nsutil = require('netsuite-uploader-util');

// "Constants"
var watchFilter = 'netsuite_code/**/*.js';
var account = 'TSTDRV1234567';
var role = 3;

gulp.task('default', () => {
    var client = new nsutil.SuiteTalk();
    var creds = nsutil.Credentials;

    console.log('Configuring SuiteTalk client...');
    client.init(creds.email, creds.password, account, role).then(() => {
        console.log('SuiteTalk client configured.');
        console.log('Watching: ' + watchFilter);

        watch(watchFilter, file => {
            console.log(`File changed. Uploading File: ${file.path}...`);
            var pathParts = file.path.split(/\\|\//);
            var idx = pathParts.indexOf('netsuite_code')+1;
            
            var filename = pathParts.slice(idx).join('/');

            var suiteScriptPath = `SuiteScripts/My App/${filename}`;

            client.upload(file.path, suiteScriptPath).then(r=>{
                console.log('  Uploaded File: ' + suiteScriptPath);
            }, err => {
                console.log('  Failed to Upload File: ' + err);
            });
        });
    });
});
```