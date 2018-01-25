const roleInquirer = require('netsuite-role-inquirer').main
const nsutil = require('..')
const path = require('path')

async function test () {
  const client = new nsutil.SuiteTalk()
  let { credentials, roles, role } = await roleInquirer()
  let options = credentials
  options.account = role.account.internalId
  options.role = role.role.internalId
  options.debug = false
  await client.init(options)
  await client.upload(
    path.join(__dirname, 'test1.js'),
    '/SuiteScripts/test1.js'
  )
}

test()
