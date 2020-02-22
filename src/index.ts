export interface SASjsRequest {
  serviceLink: string;
  timestamp: Date;
  sourceCode: string;
  generatedCode: string;
  logLink: string;
}

export class SASjsConfig {
  serverUrl: string = "";
  port: number | null = null;
  pathSAS9: string = "";
  pathSASViya: string = "";
  appLoc: string = "";
  serverType: string = "";
  debug: boolean = true;
}

export default class SASjs {
  private sasjsConfig = new SASjsConfig();

  private serverUrl: string = "";
  private jobsPath: string = "";
  private appLoc: string = "";
  private logoutUrl: string = "";
  private loginFormData: any = null;
  private loginLink: string = "";
  private _csrf: string | null = null;
  private retryCount: number = 0;
  private retryLimit: number = 5;
  private sasjsRequests: SASjsRequest[] = [];
  private userName: string = "";

  private defaultConfig: SASjsConfig = {
    serverUrl: " ",
    port: null,
    pathSAS9: "/SASStoredProcess/do",
    pathSASViya: "/SASJobExecution",
    appLoc: "/Public/seedapp",
    serverType: "SASVIYA",
    debug: true
  };

  constructor(config?: SASjsConfig) {
    if (config) {
      this.sasjsConfig = config;
    } else {
      this.sasjsConfig = this.defaultConfig;
    }

    this.configSetup();
  }

  private configSetup() {
    this.serverUrl = this.sasjsConfig.port
      ? this.sasjsConfig.serverUrl + ":" + this.sasjsConfig.port
      : this.sasjsConfig.serverUrl;
    this.jobsPath =
      this.sasjsConfig.serverType === "SASVIYA"
        ? this.sasjsConfig.pathSASViya
        : this.sasjsConfig.pathSAS9;
    this.appLoc = this.sasjsConfig.appLoc;
    this.loginLink = `${this.serverUrl}/SASLogon/login`;
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

  public setDebugState(value: boolean) {
    this.sasjsConfig.debug = value;
  }

  private getLoginURL = (matches: RegExpExecArray) => {
    let parsedURL = matches[1].replace(/\?.*/, "");
    if (parsedURL[0] === "/") {
      parsedURL = parsedURL.substr(1);

      const tempLoginLink = this.serverUrl
        ? `${this.serverUrl}/${parsedURL}`
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
      const logOutURL = `${this.serverUrl}${this.logoutUrl}`;
      fetch(logOutURL)
        .then(() => {
          resolve(true);
        })
        .catch((e: Error) => {
          reject(e);
        });
    });
  }

  public async checkSession() {
    const loginResponse = await fetch(this.loginLink);
    const responseText = await loginResponse.text();
    const loginFormData = this.logInRequired(responseText);
    if (loginFormData) {
      this.loginFormData = loginFormData;
    }
    return Promise.resolve({ isLoggedIn: !!!loginFormData });
  }

  public async SASlogin(username: string, password: string) {
    const loginParams: any = {
      _service: "default",
      username,
      password
    };

    if (!this.loginFormData) {
      const { isLoggedIn } = await this.checkSession();
      if (isLoggedIn) {
        return Promise.resolve("User already logged in");
      }
    }

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
        longestValueForField ? longestValueForField : "best"
      }.`;
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
    const program = this.appLoc
      ? this.appLoc.replace(/\/?$/, "/") + programName.replace(/^\//, "")
      : programName;
    const apiLink = `${this.serverUrl}${this.jobsPath}/?_program=${program}`;

    if (!params) {
      params = {};
    }

    if (this._csrf) {
      params["_csrf"] = this._csrf;
    }

    if (this.sasjsConfig.debug) {
      params["_omittextlog"] = "false";
      params["_omitsessionresults"] = "false";
      if (this.sasjsConfig.serverType === "SAS9") {
        params["_debug"] = 131;
      }
    }

    const self = this;

    const formData = new FormData();

    if (data) {
      if (this.sasjsConfig.serverType === "SAS9") {
        // file upload approach
        for (const tableName in data) {
          const name = tableName;
          const csv = this.convertToCSV(data[tableName]);

          formData.append(
            name,
            new Blob([csv], { type: "application/csv" }),
            `${name}.csv`
          );
        }
      } else {
        // param based approach
        const sasjsTables = [];
        let tableCounter = 0;
        for (const tableName in data) {
          tableCounter++;
          sasjsTables.push(tableName);
          const csv = this.convertToCSV(data[tableName]);
          params[`sasjs${tableCounter}data`] = csv;
        }
        params["sasjs_tables"] = sasjsTables.join(" ");
      }
    }
    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        formData.append(key, params[key]);
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
      if (!this.sasjsConfig.debug) {
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
          if (jobUrl) {
            fetch(this.serverUrl + jobUrl, {
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
                  console.error("Error parsing json:", e);
                }

                if (responseJson) {
                  pgmData = responseJson.jobRequest.jobDefinition.code;
                  logUri = responseJson.links.find(
                    (link: { rel: string }) => link.rel === "log"
                  ).uri;
                  logUri += "/content";

                  logUri = this.serverUrl + logUri;

                  if (logUri) {
                    this.fetchLogFileContent(logUri)
                      .then((logContent: any) => {
                        this.appendSasjsRequest(logContent, program, pgmData);
                      })
                      .catch((err: Error) => {
                        console.error("error getting log content:", err);
                      });
                  }
                }
              })
              .catch((err: Error) => {
                console.error("error fetching viya job:",err);
              });
          }
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

  private appendSasjsRequest(log: any, program: string, pgmData: any) {
    let sourceCode= "";
    let generatedCode = "";

    if (log) {
      if (this.sasjsConfig.serverType === "SAS9") {
        sourceCode = this.parseSAS9SourceCode(log);
      } else {
        const pgmLines= pgmData.split("\r")
        sourceCode=pgmLines.join("\r\n");
      }
      generatedCode = this.parseGeneratedCode(log);
    }

    this.sasjsRequests.push({
      logLink: log,
      serviceLink: program,
      timestamp: new Date(),
      sourceCode,
      generatedCode
    });

    if (this.sasjsRequests.length > 20) {
      this.sasjsRequests.splice(0, 1);
    }
  }

  private parseSAS9SourceCode(log: string) {
    const isSourceCodeLine = (line: string) =>
      line
        .trim()
        .substring(0, 10)
        .trimStart()
        .match(/^\d/);
    const logLines = log.split("\n").filter(isSourceCodeLine);
    return logLines.join("\r\n");
  }

  private parseGeneratedCode(log: string) {
    let startsWith="normal:";
    if (this.sasjsConfig.serverType === "SAS9") {
      startsWith="MPRINT";
    }
    const isGeneratedCodeLine = (line: string) =>
      line.trim().startsWith(startsWith);
    const logLines = log.split("\n").filter(isGeneratedCodeLine);
    return logLines.join("\r\n");
  }

  public getSasRequests() {
    const sortedRequests = this.sasjsRequests.sort(compareTimestamps);
    return sortedRequests;
  }
}

const compareTimestamps = (a: SASjsRequest, b: SASjsRequest) => {
  return b.timestamp.getTime() - a.timestamp.getTime();
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
