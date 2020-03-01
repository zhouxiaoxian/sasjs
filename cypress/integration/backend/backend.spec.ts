/// <reference types="cypress" />
import SASjs from "../../../src/index";
import { any } from "cypress/types/bluebird";

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

  it("ARR, single string value", done => {
    const data:any= {table1: [{ col1: "first col value" }]};
    adapter.request("common/sendArr", data).then((res: any) => {
      expect(res.table1[0][0]).to.not.be.undefined
      expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
      done();
    });
  });
  it("OBJ, single string value", done => {
    const data:any= {table1: [{ col1: "first col value" }]};
    adapter.request("common/sendObj", data).then((res: any) => {
      expect(res.table1[0].COL1).to.not.be.undefined
      expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
      done();
    });
  });
  it("ARR, long string (32765)", done => {
    /* cannot use repeat() function due to strange typings */
    let x='X';
    for (var i=1;i <32765;i++){x=x+'X'}
    const data:any= {table1: [{ col1: x}]};
    adapter.request("common/sendArr", data).then((res: any) => {
      expect(res.table1[0][0]).to.not.be.undefined
      expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
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
