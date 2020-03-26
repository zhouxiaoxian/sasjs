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

const debugStates = [Cypress.env("debug"), !Cypress.env("debug")];
debugStates.forEach(debugState => {
  context(
    "Testing " + Cypress.env("serverType") + ": debug=" + debugState,
    () => {
      before(function() {
        // runs once before all tests in the block
        adapter.setDebugState(debugState);
      });

      it("Retry request after login", done => {
        testStart();

        const data: any = { table1: [{ col1: "first col value" }] };
        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          console.log("Request after login:", res);

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
          done();
        });

        setTimeout(() => {
          adapter.logIn(Cypress.env("username"), Cypress.env("password")).then(
            (res: any) => {
              console.log(res);
            },
            err => {
              console.log(err);
            }
          );
        }, 5000);

        cy.wait(10000);
      });

      it("Send null values in request data", done => {
        testStart();

        const data: any = {
          table1: [
            { col1: "first col value", col2: null },
            { col1: "second row vlaue", col2: "above is null" }
          ]
        };
        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
          expect(res.table1[0][1]).to.be.equal(data.table1[0].col2);
          done();
        });
      });

      it("Send undefined values in request data", done => {
        testStart();

        const data: any = {
          table1: [{ col1: "first col value" }, { col2: undefined }]
        };
        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
          expect(res.table1[0][1]).to.be.equal(data.table1[0].col2);
          done();
        });
      });
    }
  );
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
