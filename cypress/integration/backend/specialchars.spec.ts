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

let timestampStart: number, timestampFinish: number;

context("Testing SAS", () => {
  it("User login", done => {
    adapter.logIn(Cypress.env("username"), Cypress.env("password")).then(
      (res: any) => {
        expect(res.isLoggedIn).to.equal(true);
        done();
      },
      err => {
        console.log(err);
        done("User not logged");
      }
    );
  });

  it("ARR, special chars(tab, CRLF, CR, UTF8)", done => {
    testStart();

    const data: any = {
      table1: [{ col1: "\t", col2: "\r\n", col3: "\r", col4: "传/傳" }]
    };
    adapter.request("common/sendArr", data).then(
      (res: any) => {
        testFinish();

        expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
        expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
        expect(res.table1[0][1]).to.be.equal(data.table1[0].col2);
        expect(res.table1[0][2]).to.be.equal(data.table1[0].col3);
        expect(res.table1[0][3]).to.be.equal(data.table1[0].col4);
        done();
      },
      err => {
        console.log(err);
      }
    );
  });

  it("OBJ, special chars(tab, CRLF, CR, UTF8)", done => {
    testStart();

    const data: any = {
      table1: [{ col1: "\txxxxxxxxxxxxxx", col2: "\r\nxxxxxxxxxxxxxxxx", col3: "\rxxxxxxxxxxxxxx", col4: "传/傳xxxxxxxxxxx" }]
    };
    adapter.request("common/sendObj", data).then(
      (res: any) => {
        testFinish();

        expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
        expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
        expect(res.table1[0].COL2).to.be.equal(data.table1[0].col2);
        expect(res.table1[0].COL3).to.be.equal(data.table1[0].col3);
        expect(res.table1[0].COL4).to.be.equal(data.table1[0].col3);
        done();
      },
      err => {
        console.log(err);
      }
    );
  });
});

const testStart = () => {
  timestampStart = new Date().getTime();
};

const testFinish = () => {
  timestampFinish = new Date().getTime();
};

const getTestExecTime = () => {
  return (
    "(Execution time: " +
    (timestampFinish - timestampStart) / 1000 +
    " seconds)"
  );
};
