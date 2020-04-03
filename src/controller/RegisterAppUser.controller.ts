import { Request, Response, NextFunction, request } from 'express';
import { Client } from 'models/Client.model';
const SQL = require('mssql');
const SQL_CONFIGURATION = require('../configuration.json');
const phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
const axios = require('axios');

var crypto = require('crypto');
var fs = require('fs');

export class RegisterAppUserController {
    RegisterAppUser = async (
        request: Request, 
        response: Response,
        next : NextFunction
    ) => {
        try{ 
            // Params list
            const phoneNumber = request.body.ph;
            const client = request.body.client as Client;
            const DVenID = client.DVentId;
            const AppVer = client.AppVer;
            const AppId = client.AppID;
            const DM = client.DM;
            const OsVer = client.OsVer;
            if(phoneNumber ===  '' && client === null) {
               return response.status(400).send({ error: "Enter Full information is  required" });
            }

            let internationalPhNo = "";

            let checkInter = IsPhoneNumberInInternationalFormat.some(phoneNumber);
            if(!checkInter) {
              internationalPhNo = '+' + phoneNumber;
            }else {
                internationalPhNo = phoneNumber;
            }

            console.log(internationalPhNo);
            if(
                internationalPhNo === null ||
                internationalPhNo === "" ||
                internationalPhNo === undefined ||
                !internationalPhNo
              ) {
                  return response.status(400).send({ error: "Phone Number is invalid" });
              }else
              SQL.connect(SQL_CONFIGURATION)
            .then((pool:any) => {
                return pool.request()
                .input('phoneNumber', SQL.VarChar(64), internationalPhNo)
                .output('userExists', SQL.boolean)
                .execute('spne_CheckUserExistanceByPhoneNumber', internationalPhNo);
            })
            .then((result: any) => {
                const userExist = result.output.userExist === '0';
                if(!userExist) {
                    const unBlockDb = UnBlockUser.unblock(internationalPhNo);  
                    const createDirectory = UnBlockUser.createDirectory();
                    const createUserXmpp = createUser();
                    const generateDeviceKey = GenDeviceKey.generateDeviceKey(internationalPhNo, DVenID, AppId); 
                    const registerUserVoip = regUserVoip();
                    if(unBlockDb != null && createUserXmpp && generateDeviceKey != null && registerUserVoip) {
                      return response.status(200).send({ success: true });
                    }else {
                      return response.status(400).send({ error: false });
                    }
                }else {
                  const upDateDeviceInfo = upDateUserDeviceInfo.updateInfo(DVenID, AppId, AppVer);
                  const generateDeviceKey = GenDeviceKey.generateDeviceKey(internationalPhNo, DVenID, AppId); 
                  const registerUserVoip = regUserVoip();
                  if(upDateDeviceInfo != null && generateDeviceKey != null && registerUserVoip) {
                    return response.status(200).send({ success: true });

                  }else {
                    return response.status(400).send({ error: false });
                  }
                }
            })
       
        }
        catch(error) {
            response.status(500).send({error});
    
    }
  }
}

/**
 * Register User to voip Server.
 
 * @return it will return message.
 */

const voipApi = 'http://rtsip.neeopal.com/NeoWeb/register.php';
let regUserVoip = async () =>  {
    try {
      const params = {
        mode: 'add',
        mob: '123455677',
        pass: '12345',

      };
      const config = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Axios',
            'key': 'voipSecretKey',
            'value': '12345'
        }
      };
      const res = await axios.post('http://rtsip.neeopal.com/NeoWeb/register.php', params, config);
        console.log(res);
        // if(res.data.result === 'Error') {
        //   console.log(res.data.message,'I am in error');
        //   return res.data.message;
        // }else {
        //   console.log(res.data.message, 'I am in success');
        //   return res.data.message;
        // }
       }catch (error) {
        
          return error;
       }
}


/**
 * Register User to Xmpp Server.
 * @param {string} phoneNumber The first params.
 * @param {string} deviceVenderID The second param.
 * @return it will send 201 status in sccess case.
 */



const createUser = async () => {
    try {
        // request data object
        const data = {
            username: 'test3',
            password: 'start12234',
            name: '',
            email: 'test3@example.com'
        };

        // request config that includes `headers`
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Axios',
                'Authorization': 'B8z0WBmnxZRoHRbv'
            }
        };
        const res = await axios.post('http://open.bnmax.com:9090/plugins/restapi/v1/users', data, config);
        return true;
    } catch (err) {
        const error = JSON.stringify(err.name);
        if(error === 'Error') {
            return false;
        }else {
            return;
        }
       
    }
    
}
/**
 * Update device Info.
 * @param {any} userId The first params.
 * @param {string}  applicationID The second param.
 * @param {string} applicationVersion The second param.
 * @return 
 */
let upDateUserDeviceInfo = {
  updateInfo: function(
      userId : any, 
      applicationId: string, 
      applicationVersion: string, 
      
       ) {
        SQL.connect(SQL_CONFIGURATION)
         .then((pool: any) => {
          //Stored procedure to update device info
          return pool
         .request()
         .execute('spne_UpdateUserDeviceInfoByPhoneNumber', 
         userId, 
         applicationId, 
         applicationVersion, 
         );
      })
  }
}


/**
 * Generate Device Key.
 * @param {string} phoneNumber The first params.
 * @param {string} deviceVenderID The second param.
 * * @param {string} applicationID The second param.
 * @return It will generate md5 hexadecimal string from MD5 encryption
 */

const GenDeviceKey = {
  generateDeviceKey: function(
    phoneNumber: string, 
    deviceVenderID: string, 
    applicationID: string
    ) {
    const hasingData: string = phoneNumber + deviceVenderID + applicationID;
    let hash = crypto.createHash('md5').update(hasingData).digest("hex")
    return hash;  
  }
}


let UnBlockUser = {
    unblock(phone: any) {
        SQL.connect(SQL_CONFIGURATION)
        .then((pool: any) => {
            //Stored procedure to unblock user
            return pool
            .request()
            .input('phoneNumber', SQL.VarChar(64), phone)
            .execute('spne_DeleteUserBlockedStateByPhoneNumber', phone);
        })
        .then((result: any) => {
            return result;
          }).catch((err: any) => {
            return err;
          }) 
    },

    createDirectory() {
      const path = './server';
      if(!fs.existsSync(path)) {
        fs.mkdirSync(path);
      }
    }
}

var IsPhoneNumberInInternationalFormat = {
    some: function(phone: string) {
      let internationalNumberPrefix = ["00", "+"];
      if (phone.length >= 2) {
        if (
          phone.substring(0, 2) != internationalNumberPrefix[0] &&
          phone.substring(0, 1) != internationalNumberPrefix[1]
        ) {
          return false;
        }
        return true;
      }
    }
  };
  
  var ValidatePhoneNumber = {
    some: function(pho: string) {
      try {
        var phoneNumberInfo = phoneUtil.Parse(pho, null);
        console.log("1" + " " + phoneNumberInfo);
        var isPossiblePhoneNumber = phoneUtil.IsPossibleNumber(phoneNumberInfo);
        console.log("2" + " " + isPossiblePhoneNumber);
        var isValidPhoneNumber = phoneUtil.IsValidNumber(phoneNumberInfo);
        console.log("3" + " " + isPossiblePhoneNumber);
        if (isPossiblePhoneNumber || isValidPhoneNumber) {
          var countryCode = phoneNumberInfo.CountryCode.ToString();
          console.log("4" + " " + countryCode);
          var numberWithoutCountryCode = pho.substring(
            countryCode.Length + 1,
            pho.length - (countryCode.Length + 1)
          );
          console.log("5" + " " + numberWithoutCountryCode);
          if (numberWithoutCountryCode.substring(0, 1) == "0") {
            return false;
          }
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    }
  };

