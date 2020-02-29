/// <reference types="cypress" />
import SASjs from "../../../src/index";

const adapter = new SASjs({
  serverUrl: Cypress.env("serverUrl"),
  port: Cypress.env("port"),
  pathSAS9: "/SASStoredProcess/do",
  pathSASViya: "/SASJobExecution",
  appLoc: Cypress.env("appLoc"),
  serverType: Cypress.env("serverType"),
  debug: Cypress.env("debug")
});

context("Testing SAS", () => {
  it("User login", done => {
    let userLoggedIn = false;

    adapter.SASlogin(Cypress.env("username"), Cypress.env("password")).then(
      (res: any) => {
        if (
          res.includes("You have signed in") ||
          res.includes("User already logged in")
        ) {
          userLoggedIn = true;
        }

        expect(userLoggedIn).to.equal(true);
        done();
      },
      err => {
        console.log(err);
        done("User not logged");
      }
    );
  });

  it("Should make request", done => {
    const data = {
      sometable: [{ firstCol: "first col value" }]
    };

    const expectedData = [["first col value"]];

    makeRequest("common/sendArr", data).then((actualData: any) => {
      expect(JSON.stringify(actualData.sometable)).to.be.equal(
        JSON.stringify(expectedData)
      );
      done();
    });
  });
});

const makeRequest = (url: string, data: any): Promise<any> => {
  let jsonResponse: any;
  return new Promise((resolve, reject) => {
    return adapter.request(url, data).then(
      (res: any) => {
        if (res.includes("449") || !res.includes(Object.keys(data)[0])) {
          return adapter
            .request(url, data)
            .then((r: any) => resolve(JSON.parse(r)));
        }
        try {
          jsonResponse = JSON.parse(res);
        } catch (e) {
          console.log(e);
          reject("Response is not json");
        }

        resolve(jsonResponse);
      },
      err => {
        console.error(err);
        reject("Request failed");
      }
    );
  });
};
