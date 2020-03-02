export interface SASjsRequest {
  serviceLink: string;
  timestamp: Date;
  sourceCode: string;
  generatedCode: string;
  logFile: string;
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

const defaultConfig: SASjsConfig = {
  serverUrl: " ",
  port: null,
  pathSAS9: "/SASStoredProcess/do",
  pathSASViya: "/SASJobExecution",
  appLoc: "/Public/seedapp",
  serverType: "SASVIYA",
  debug: true
};

/**
 * SASjs is a JavaScript adapter for SAS.
 *
 */
export default class SASjs {
  private sasjsConfig = new SASjsConfig();
  private serverUrl: string = "";
  private jobsPath: string = "";
  private appLoc: string = "";
  private logoutUrl: string = "";
  private loginUrl: string = "";
  private _csrf: string | null = null;
  private retryCount: number = 0;
  private retryLimit: number = 5;
  private sasjsRequests: SASjsRequest[] = [];
  private userName: string = "";

  constructor(config?: SASjsConfig) {
    if (config) {
      this.sasjsConfig = config;
    } else {
      this.sasjsConfig = defaultConfig;
    }

    this.setupConfiguration();
  }

  /**
   * Returns the current SASjs configuration.
   *
   */
  public getSasjsConfig() {
    return this.sasjsConfig;
  }

  /**
   * Returns the username of the user currently logged in.
   *
   */
  public getUserName() {
    return this.userName;
  }

  /**
   * Sets the debug state.
   * @param value - Boolean indicating debug state
   */
  public setDebugState(value: boolean) {
    this.sasjsConfig.debug = value;
  }

  /**
   * Checks whether a session is active, or login is required
   * @returns a promise which resolves with an object containing two values - a boolean `isLoggedIn`, and a string `userName`
   */
  public async checkSession() {
    const loginResponse = await fetch(this.loginUrl);
    const responseText = await loginResponse.text();
    const isLoginRequired = this.isLogInRequired(responseText);

    return Promise.resolve({
      isLoggedIn: !isLoginRequired,
      userName: this.userName
    });
  }

  /**
   * Logs into the SAS server with the supplied credentials
   * @param username - a string representing the username
   * @param password - a string representing the password
   */
  public async logIn(username: string, password: string) {
    const loginParams: any = {
      _service: "default",
      username,
      password
    };

    this.userName = loginParams.username;

    const { isLoggedIn } = await this.checkSession();
    if (isLoggedIn) {
      return Promise.resolve({
        isLoggedIn,
        userName: this.userName
      });
    }

    const loginForm = await this.getLoginForm();

    for (const key in loginForm) {
      loginParams[key] = loginForm[key];
    }
    const loginParamsStr = serialize(loginParams);

    return fetch(this.loginUrl, {
      method: "post",
      credentials: "include",
      body: loginParamsStr,
      headers: new Headers({
        "Content-Type": "application/x-www-form-urlencoded"
      })
    })
      .then(response => response.text())
      .then(responseText => ({
        isLoggedIn: !this.isLogInRequired(responseText),
        userName: this.userName
      }))
      .catch(e => Promise.reject(e));
  }

  /**
   * Logs out of the configured SAS server
   */
  public logOut() {
    return new Promise((resolve, reject) => {
      const logOutURL = `${this.serverUrl}${this.logoutUrl}`;
      fetch(logOutURL)
        .then(() => {
          resolve(true);
        })
        .catch((err: Error) => reject(err));
    });
  }

  private convertToCSV(data: any) {
    const replacer = (key: any, value: any) => (value === null ? "" : value);
    const headerFields = Object.keys(data[0]);
    let csvTest;
    const headers = headerFields.map(field => {
      let firstFoundType: string | null = null;
      let hasMixedTypes: boolean = false;
      let rowNumError: number = -1;

      const longestValueForField = data
        .map((row: any, index: number) => {
          if (row[field] || row[field] === "") {
            if (firstFoundType) {
              let currentFieldType =
                row[field] === "" || typeof row[field] === "string"
                  ? "chars"
                  : "number";

              hasMixedTypes = currentFieldType !== firstFoundType;
              rowNumError = hasMixedTypes ? index + 1 : -1;
            } else {
              if (row[field] === "") {
                firstFoundType = "chars";
              } else {
                firstFoundType =
                  typeof row[field] === "string" ? "chars" : "number";
              }
            }
            return row[field].length;
          }
        })
        .sort((a: number, b: number) => b - a)[0];

      if (hasMixedTypes) {
        console.error(
          `Row number: ${rowNumError}: Column (${field}) has mixed types: ERROR`
        );
      }

      return `${field}:${firstFoundType === "chars" ? "$" : ""}${
        longestValueForField
          ? longestValueForField
          : firstFoundType === "chars"
          ? "1"
          : "best"
      }.`;
    });

    csvTest = data.map((row: any) => {
      const fields = Object.keys(row).map((fieldName, index) => {
        let value;
        const currentCell = row[fieldName];

        value = JSON.stringify(currentCell, replacer);
        if (!value.includes(",")) {
          value = value.replace(/"/g, "");
        }

        if (value === "" && headers[index].includes("best")) {
          value = ".";
        }

        return value;
      });
      return fields.join(",");
    });
  }

  /**
   * Makes a request to the program specified.
   * @param programName - a string representing the SAS program name
   * @param data - an object containing the data to be posted
   * @param params - an optional object with any additional parameters
   */
  public async request(programName: string, data: any, params?: any) {
    const program = this.appLoc
      ? this.appLoc.replace(/\/?$/, "/") + programName.replace(/^\//, "")
      : programName;
    const apiUrl = `${this.serverUrl}${this.jobsPath}/?_program=${program}`;

    const inputParams = params ? params : {};
    const requestParams = {
      ...inputParams,
      ...this.getRequestParams()
    };

    const self = this;

    const formData = new FormData();

    if (data) {
      if (this.sasjsConfig.serverType === "SAS9") {
        // file upload approach
        for (const tableName in data) {
          const name = tableName;
          const csv = convertToCSV(data[tableName]);

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
          const csv = convertToCSV(data[tableName]);
          requestParams[`sasjs${tableCounter}data`] = csv;
        }
        requestParams["sasjs_tables"] = sasjsTables.join(" ");
      }
    }
    for (const key in requestParams) {
      if (requestParams.hasOwnProperty(key)) {
        formData.append(key, requestParams[key]);
      }
    }

    return new Promise((resolve, reject) => {
      fetch(apiUrl, {
        method: "POST",
        body: formData,
        referrerPolicy: "same-origin"
      })
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

          if (response.redirected && this.sasjsConfig.serverType === "SAS9") {
            return "redirected response - retry request";
          }

          return response.text();
        })
        .then(responseText => {
          if (this.needsRetry(responseText)) {
            if (this.retryCount < this.retryLimit) {
              this.retryCount++;
              this.request(programName, data, params)
                .then((res: any) => resolve(res))
                .catch((err: Error) => reject(err));
            } else {
              this.retryCount = 0;
              reject(responseText);
            }
          } else {
            this.retryCount = 0;
            this.parseLogFromResponse(responseText, program);
            this.updateUsername(responseText);

            if (self.isLogInRequired(responseText)) {
              reject(new Error("login required"));
            } else {
              if (
                this.sasjsConfig.serverType === "SAS9" &&
                this.sasjsConfig.debug
              ) {
                const jsonResponseText = this.parseSAS9Response(responseText);
                resolve(JSON.parse(jsonResponseText));
              } else {
                resolve(JSON.parse(responseText));
              }
            }
          }
        })
        .catch((e: Error) => {
          reject(e);
        });
    });
  }

  private needsRetry(responseText: string): boolean {
    return (
      (responseText.includes("_csrf") &&
        responseText.includes("error") &&
        responseText.includes("403")) ||
      responseText.includes("449") ||
      responseText.includes("redirected response - retry request")
    );
  }

  private getRequestParams(): any {
    const requestParams: any = {};

    if (this._csrf) {
      requestParams["_csrf"] = this._csrf;
    }

    if (this.sasjsConfig.debug) {
      requestParams["_omittextlog"] = "false";
      requestParams["_omitsessionresults"] = "false";
      if (this.sasjsConfig.serverType === "SAS9") {
        requestParams["_debug"] = 131;
      }
    }

    return requestParams;
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
      console.error(e);
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
                console.error("Error fetching VIYA job", err);
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
    let sourceCode = "";
    let generatedCode = "";

    if (log) {
      if (this.sasjsConfig.serverType === "SAS9") {
        sourceCode = this.parseSAS9SourceCode(log);
      } else {
        const pgmLines = pgmData.split("\r");
        sourceCode = pgmLines.join("\r\n");
      }
      generatedCode = this.parseGeneratedCode(log);
    }

    this.sasjsRequests.push({
      logFile: log,
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
    let startsWith = "normal:";
    if (this.sasjsConfig.serverType === "SAS9") {
      startsWith = "MPRINT";
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

  private setupConfiguration() {
    this.serverUrl = this.sasjsConfig.port
      ? this.sasjsConfig.serverUrl + ":" + this.sasjsConfig.port
      : this.sasjsConfig.serverUrl;
    this.jobsPath =
      this.sasjsConfig.serverType === "SASVIYA"
        ? this.sasjsConfig.pathSASViya
        : this.sasjsConfig.pathSAS9;
    this.appLoc = this.sasjsConfig.appLoc;
    this.loginUrl = `${this.serverUrl}/SASLogon/login`;
    this.logoutUrl =
      this.sasjsConfig.serverType === "SAS9"
        ? "/SASLogon/logout?"
        : "/SASLogon/logout.do?";
  }

  private setLoginUrl = (matches: RegExpExecArray) => {
    let parsedURL = matches[1].replace(/\?.*/, "");
    if (parsedURL[0] === "/") {
      parsedURL = parsedURL.substr(1);

      const tempLoginLink = this.serverUrl
        ? `${this.serverUrl}/${parsedURL}`
        : `${parsedURL}`;

      let loginUrl = tempLoginLink;
      if (this.sasjsConfig.serverType === "SAS9") {
        loginUrl = this.getSas9LoginUrl(tempLoginLink);
      }

      this.loginUrl = loginUrl;
    }
  };

  private getSas9LoginUrl = (loginUrl: string) => {
    const tempLoginLinkArray = loginUrl.split(".");
    const doIndex = tempLoginLinkArray.indexOf("do");

    if (doIndex > -1) {
      tempLoginLinkArray.splice(doIndex, 1);
    }

    return tempLoginLinkArray.join(".");
  };

  private async getLoginForm() {
    const pattern: RegExp = /<form.+action="(.*Logon[^"]*).*>/;
    const response = await fetch(this.loginUrl).then(r => r.text());
    const matches = pattern.exec(response);
    const formInputs: any = {};
    if (matches && matches.length) {
      this.setLoginUrl(matches);
      const inputs = response.match(/<input.*"hidden"[^>]*>/g);
      if (inputs) {
        inputs.forEach((inputStr: string) => {
          const valueMatch = inputStr.match(/name="([^"]*)"\svalue="([^"]*)/);
          if (valueMatch && valueMatch.length) {
            formInputs[valueMatch[1]] = valueMatch[2];
          }
        });
      }
    }
    return Object.keys(formInputs).length ? formInputs : null;
  }

  private isLogInRequired = (response: any) => {
    const pattern: RegExp = /<form.+action="(.*Logon[^"]*).*>/;
    const matches = pattern.exec(response);
    return !!(matches && matches.length);
  };
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

function convertToCSV(data: any) {
  const replacer = (key: any, value: any) => (value === null ? "" : value);
  const headerFields = Object.keys(data[0]);
  let csvTest;
  const headers = headerFields.map(field => {
    const longestValueForField = data
      .map((row: any) => row[field].length)
      .sort((a: number, b: number) => b - a)[0];
    return `${field}:$${longestValueForField ? longestValueForField : "best"}.`;
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
