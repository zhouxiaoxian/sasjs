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
      table1: [
        {
          col1: "\txxxxxxxxxxxxxx",
          col2: "\r\nxxxxxxxxxxxxxxxx",
          col3: "\rxxxxxxxxxxxxxx",
          col4: "传/傳xxxxxxxxxxx"
        }
      ]
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

  it("ARR, wide table(many columns)", done => {
    testStart();

    let cols: any = {};
    for (var i = 1; i <= 10000; i++) {
      cols["col" + i] = "test" + i;
    }

    const data: any = {
      table1: [cols]
    };
    adapter.request("common/sendArr", data).then(
      (res: any) => {
        testFinish();

        expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
        data.table1[0].map((col: any, index: number) => {
          expect(res.table1[0]["COL" + index]).to.be.equal(
            data.table1[0]["col" + index]
          );
        });
        done();
      },
      err => {
        console.log(err);
      }
    );
  });

  it("OBJ, wide table(many columns)", done => {
    testStart();

    let cols: any = {};
    for (var i = 1; i <= 10000; i++) {
      cols["col" + i] = "test" + i;
    }

    const data: any = {
      table1: [cols]
    };
    adapter.request("common/sendObj", data).then(
      (res: any) => {
        testFinish();

        expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
        data.table1[0].map((col: any, index: number) => {
          expect(res.table1[0]["COL" + index]).to.be.equal(
            data.table1[0]["col" + index]
          );
        });
        done();
      },
      err => {
        console.log(err);
      }
    );
  });

  it("ARR, many tables", done => {
    testStart();

    let tables: any = {};

    for (var i = 1; i <= 1000; i++) {
      tables["table" + i] = [{ col1: "x", col2: "x", col3: "x", col4: "x" }];
    }

    const data: any = tables;
    adapter.request("common/sendArr", data).then(
      (res: any) => {
        testFinish();

        expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
        data.table1.map((row: any, index: number) => {
          expect(res.table1[index][0]).to.be.equal(data.table1[index].col1);
          expect(res.table1[index][1]).to.be.equal(data.table1[index].col2);
          expect(res.table1[index][2]).to.be.equal(data.table1[index].col3);
          expect(res.table1[index][3]).to.be.equal(data.table1[index].col4);
        });
        done();
      },
      err => {
        console.log(err);
      }
    );
  });

  it("OBJ, many tables", done => {
    testStart();

    let tables: any = {};

    for (var i = 1; i <= 1000; i++) {
      tables["table" + i] = [{ col1: "x", col2: "x", col3: "x", col4: "x" }];
    }

    const data: any = tables;
    adapter.request("common/sendObj", data).then(
      (res: any) => {
        testFinish();

        expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
        data.table1.map((row: any, index: number) => {
          expect(res.table1[index].col1).to.be.equal(data.table1[index].col1);
          expect(res.table1[index].col2).to.be.equal(data.table1[index].col2);
          expect(res.table1[index].col3).to.be.equal(data.table1[index].col3);
          expect(res.table1[index].col4).to.be.equal(data.table1[index].col4);
        });
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
