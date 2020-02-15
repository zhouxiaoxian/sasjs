import axios from "axios";
import * as moment from "moment";
import { SASjsConfig } from "./SASjsConfig";
import { SASjsRequest } from "./SASjsRequest";

export default class SASjs {
  public debugState = true;
  // Config
  private sasjsConfig: SASjsConfig = new SASjsConfig();

  private baseURL: string = "";
  private jobsPath: string = "";
  private programRoot: string = "";
  private logoutUrl: string = "";
  private loginFormData: any = null;
  private loginLink: string = "";
  private _csrf: string | null = null;
  private retryCount: number = 0;
  private retryLimit: number = 5;
  private sasjsRequests: SASjsRequest[] = [];
  private userName: string = "";

  private defaultConfig: SASjsConfig = {
    baseURL: " ",
    port: null,
    pathSAS9: "/SASStoredProcess/do",
    pathSASViya: "/SASJobExecution",
    programRoot: "/Public/seedapp",
    serverType: "SASVIYA"
  };

  constructor(config?: any) {
    this.loginLink = `${this.baseURL}/SASLogon/login.do`;

    if (config) {
      this.sasjsConfig = config;
    } else {
      this.sasjsConfig = this.defaultConfig;
    }

    this.configSetup();
  }

  private configSetup() {
    this.baseURL = this.sasjsConfig.port
      ? this.sasjsConfig.baseURL + ":" + this.sasjsConfig.port
      : this.sasjsConfig.baseURL;
    this.jobsPath =
      this.sasjsConfig.serverType === "SASVIYA"
        ? this.sasjsConfig.pathSASViya
        : this.sasjsConfig.pathSAS9;
    this.programRoot = this.sasjsConfig.programRoot;
    this.logoutUrl =
      this.sasjsConfig.serverType === "SAS9"
        ? "/SASLogon/logout?"
        : "/SASLogon/logout.do?";
  }

  public getSasjsConfig() {
    return this.sasjsConfig;
  }

  public getUserName() {
    return this.userName;
  }

  private getLoginURL = (matches: RegExpExecArray) => {
    let parsedURL = matches[1].replace(/\?.*/, "");
    if (parsedURL[0] === "/") {
      parsedURL = parsedURL.substr(1);

      const tempLoginLink = this.baseURL
        ? `${this.baseURL}/${parsedURL}`
        : `${parsedURL}`;

      if (this.sasjsConfig.serverType === "SAS9") {
        this.converLoginToSas9(tempLoginLink);
      } else {
        this.loginLink = tempLoginLink;
      }
    }
  };

  private converLoginToSas9 = (loginUrl: string) => {
    const tempLoginLinkArray = loginUrl.split(".");
    const doIndex = tempLoginLinkArray.indexOf("do");

    if (doIndex > -1) {
      tempLoginLinkArray.splice(doIndex, 1);
    }

    this.loginLink = tempLoginLinkArray.join(".");
  };

  private logInRequired = (response: any) => {
    const pattern: RegExp = /<form.+action="(.*Logon[^"]*).*>/;
    const matches = pattern.exec(response);
    let returnVal: any = false;
    if (matches) {
      this.getLoginURL(matches);
      const inputs = response.match(/<input.*"hidden"[^>]*>/g);
      const hiddenFormParams: any = {};
      if (inputs) {
        inputs.forEach((inputStr: string) => {
          const valueMatch = inputStr.match(/name="([^"]*)"\svalue="([^"]*)/);
          if (valueMatch && valueMatch.length) {
            hiddenFormParams[valueMatch[1]] = valueMatch[2];
          }
        });
        returnVal = hiddenFormParams;
      }
    }
    return returnVal;
  };

  private loginSuccess(response: any, loginParams: any) {
    const loginForm = this.logInRequired(response);

    return new Promise((resolve, reject) => {
      if (loginForm) {
        return reject("Invalid user or password");
      } else {
        return resolve(response);
      }
    });
  }

  public logOut() {
    return new Promise((resolve, reject) => {
      const logOutURL = `${this.baseURL}${this.logoutUrl}`;
      axios({
        method: "get",
        url: logOutURL
      })
        .then(() => {
          resolve(true);
        })
        .catch((e: Error) => {
          reject(e);
        });
    });
  }

  public SASlogin(username: string, password: string, callback: any = null) {
    const loginParams: any = {
      _service: "default",
      username,
      password
    };

    for (const key in this.loginFormData) {
      loginParams[key] = this.loginFormData[key];
    }
    const loginParamsStr = serialize(loginParams);
    const self = this;

    const apiReq = fetch(this.loginLink, {
      method: "post",
      credentials: "include",
      body: loginParamsStr,
      headers: new Headers({
        "Content-Type": "application/x-www-form-urlencoded"
      })
    });
    this.userName = loginParams.username;

    return new Promise((resolve, reject) => {
      apiReq
        .then(response => response.text())
        .then(response => {
          return resolve(self.loginSuccess(response, loginParams));
        })
        .catch((err: Error) => reject(err));
    });
  }

  private convertToCSV(data: any) {
    const replacer = (key: any, value: any) => (value === null ? "" : value);
    const headerFields = Object.keys(data[0]);
    let csvTest;
    const headers = headerFields.map(field => {
      const longestValueForField = data
        .map((row: any) => row[field].length)
        .sort((a: number, b: number) => b - a)[0];
      return `${field}:$${
        longestValueForField ? longestValueForField : "best."
      }`;
    });

    csvTest = data.map((row: any) => {
      const fields = Object.keys(row)
        .sort()
        .map(fieldName => {
          let value;
          const currentCell = row[fieldName];

          value = JSON.stringify(currentCell, replacer);
          if (!value.includes(",")) {
            value = value.replace(/"/g, "");
          }

          return value;
        });
      return fields.join(",");
    });

    let finalCSV =
      headers.join(",").replace(/,/g, " ") + "\\rn" + csvTest.join("\\rn");
    finalCSV = JSON.stringify(finalCSV)
      .replace(/"/g, "")
      .replace(/\\/g, '"')
      .replace(/""rn/g, "\r\n");

    return finalCSV;
  }

  public async request(
    programName: string,
    data: any,
    debug: boolean = false,
    params?: any
  ) {
    const program = this.programRoot
      ? this.programRoot.replace(/\/?$/, "/") + programName.replace(/^\//, "")
      : programName;
    const apiLink = `${this.baseURL}${this.jobsPath}/?_program=${program}`;

    if (!params) {
      params = {};
    }

    if (this._csrf) {
      params["_csrf"] = this._csrf;
    }

    if (this.debugState) {
      params["_omittextlog"] = "false";
      params["_omitsessionresults"] = "false";
      if (this.sasjsConfig.serverType === "SAS9") {
        params["_debug"] = "log";
      }
    }

    const self = this;

    const formData = new FormData();

    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        formData.append(key, params[key]);
      }
    }

    if (data) {
      for (const tableName in data) {
        const name = tableName;
        const csv = this.convertToCSV(data[tableName]);

        formData.append(
          name,
          new Blob([csv], { type: "application/csv" }),
          `${name}.csv`
        );
      }
    }

    const apiReq = fetch(apiLink, {
      method: "POST",
      body: formData,
      referrerPolicy: "same-origin"
    });

    return new Promise((resolve, reject) => {
      apiReq
        .then(response => {
          if (!response.ok) {
            if (response.status === 403) {
              const tokenHeader = response.headers.get("X-CSRF-HEADER");

              if (tokenHeader) {
                const token = response.headers.get(tokenHeader);

                this._csrf = token;
              }
            }
          }

          return response.text();
        })
        .then(response => {
          const stringReponse = JSON.stringify(response);

          if (
            stringReponse.includes("_csrf") &&
            stringReponse.includes("error") &&
            stringReponse.includes("403")
          ) {
            if (this.retryCount < this.retryLimit) {
              this.retryCount++;
              this.request(programName, data, debug, params)
                .then((res: any) => resolve(res))
                .catch((err: Error) => reject(err));
            } else {
              this.retryCount = 0;
              reject(response);
            }
          } else {
            this.retryCount = 0;
            this.parseLogFromResponse(response, program);
            this.updateUsername(response);

            const loginForm = self.logInRequired(response);
            if (loginForm) {
              // login
              self.loginFormData = loginForm;
              resolve({ login: false });
            } else {
              if (this.sasjsConfig.serverType === "SAS9") {
                const jsonResponseText = this.parseSAS9Response(response);
                resolve(jsonResponseText);
              } else {
                resolve(response);
              }
            }
          }
        })
        .catch((e: Error) => {
          reject(e);
        });
    });
  }

  private updateUsername(response: any) {
    try {
      const responseJson = JSON.parse(response);
      this.userName = responseJson["SYSUSERID"];
    } catch (e) {
      this.userName = "";
    }
  }

  private parseSAS9Response(response: string) {
    let sas9Response = "";
    try {
      sas9Response = response
        .split(">>weboutBEGIN<<")[1]
        .split(">>weboutEND<<")[0];
    } catch (e) {
      sas9Response = "";
    }

    return sas9Response;
  }

  private parseLogFromResponse(response: any, program: string) {
    if (this.sasjsConfig.serverType === "SAS9") {
      this.appendSasjsRequest(response, program, null);
    } else {
      if (!this.debugState) {
        this.appendSasjsRequest(null, program, null);
      } else {
        let jsonResponse;

        try {
          jsonResponse = JSON.parse(response);
        } catch (e) {
          console.error("Error parsing json:", e);
        }

        if (jsonResponse) {
          const jobUrl = jsonResponse["SYS_JES_JOB_URI"];

          fetch(this.baseURL + jobUrl, {
            method: "GET",
            referrerPolicy: "same-origin"
          })
            .then((res: any) => res.text())
            .then((res: any) => {
              let responseJson;
              let logUri = "";
              let pgmData = "";

              try {
                responseJson = JSON.parse(res);
              } catch (e) {
                console.log("Error parsing json:", e);
              }

              if (responseJson) {
                pgmData = responseJson.jobRequest.jobDefinition.code;
                logUri = responseJson.links.find(
                  (link: { rel: string }) => link.rel === "log"
                ).uri;
                logUri += "/content";

                logUri = this.baseURL + logUri;

                if (logUri) {
                  this.fetchLogFileContent(logUri)
                    .then((logContent: any) => {
                      this.appendSasjsRequest(logContent, program, pgmData);
                    })
                    .catch((err: Error) => {
                      console.log(err);
                    });
                }
              }
            })
            .catch((err: Error) => {
              console.log(err);
            });
        }
      }
    }
  }

  private fetchLogFileContent(logLink: string) {
    return new Promise((resolve, reject) => {
      fetch(logLink, {
        method: "GET"
      })
        .then((response: any) => response.text())
        .then((response: any) => resolve(response))
        .catch((err: Error) => reject(err));
    });
  }

  private appendSasjsRequest(logLink: any, program: string, pgmData: any) {
    this.sasjsRequests.push({
      logLink,
      serviceLink: program,
      timestamp: moment(moment.now()),
      pgmCode: pgmData
    });

    if (this.sasjsRequests.length > 20) {
      this.sasjsRequests.splice(0, 1);
    }

    console.log(this.sasjsRequests);
  }

  public getSasRequests() {
    const sortedRequests = this.sasjsRequests.sort(compareTimestamps);
    return sortedRequests;
  }
}

const compareTimestamps = (a: SASjsRequest, b: SASjsRequest) => {
  return b.timestamp.diff(a.timestamp);
};

function serialize(obj: any) {
  const str: any[] = [];
  for (const p in obj) {
    if (obj.hasOwnProperty(p)) {
      if (obj[p] instanceof Array) {
        for (let i = 0, n = obj[p].length; i < n; i++) {
          str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p][i]));
        }
      } else {
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    }
  }
  return str.join("&");
}
