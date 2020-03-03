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

  it("throws an error", done => {
    const data: any = {
      "1 invalid table": [{ col1: 42 }]
    };
    adapter.request("common/sendObj", data).then(null, (err: any) => {
      console.log(err);
      expect(err.MESSAGE).to.not.be.undefined;
      done();
    });
  });

  it("ARR, single string value", done => {
    testStart();

    const data: any = { table1: [{ col1: "first col value" }] };
    adapter.request("common/sendArr", data).then((res: any) => {
      testFinish();

      expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
      expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
      done();
    });
  });

  it("OBJ, single string value", done => {
    testStart();

    const data: any = { table1: [{ col1: "first col value" }] };
    adapter.request("common/sendObj", data).then((res: any) => {
      testFinish();

      expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
      expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
      done();
    });
  });

  it("ARR, long string (32765)", done => {
    testStart();
    /* cannot use repeat() function due to strange typings */
    let x = "X";
    for (var i = 1; i < 32765; i++) {
      x = x + "X";
    }
    const data: any = { table1: [{ col1: x }] };

    adapter.request("common/sendArr", data).then((res: any) => {
      testFinish();

      expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
      expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
      done();
    });
  });

  it("OBJ, long string (32765)", done => {
    testStart();

    let x = "X";
    for (var i = 1; i < 32765; i++) {
      x = x + "X";
    }
    const data: any = { table1: [{ col1: x }] };
    adapter.request("common/sendObj", data).then((res: any) => {
      testFinish();

      expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
      expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
      done();
    });
  });

  it("ARR, multiple columns", done => {
    testStart();

    const data: any = {
      table1: [{ col1: 42, col2: 1.618, col3: "x", col4: "x" }]
    };
    adapter.request("common/sendArr", data).then((res: any) => {
      testFinish();

      expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
      expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
      expect(res.table1[0][1]).to.be.equal(data.table1[0].col2);
      expect(res.table1[0][2]).to.be.equal(data.table1[0].col3);
      expect(res.table1[0][3]).to.be.equal(data.table1[0].col4);
      done();
    });
  });

  it("OBJ, multiple columns", done => {
    testStart();

    const data: any = {
      table1: [{ col1: 42, col2: 1.618, col3: "x", col4: "x" }]
    };
    adapter.request("common/sendObj", data).then((res: any) => {
      testFinish();

      expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
      expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
      expect(res.table1[0].COL2).to.be.equal(data.table1[0].col2);
      expect(res.table1[0].COL3).to.be.equal(data.table1[0].col3);
      expect(res.table1[0].COL4).to.be.equal(data.table1[0].col4);
      done();
    });
  });

  it("ARR, multiple rows with nulls", done => {
    testStart();

    const data: any = {
      table1: [
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: 1.62, col3: "x", col4: "x" },
        { col1: 42, col2: 1.62, col3: "x", col4: "x" }
      ]
    };
    adapter.request("common/sendArr", data).then((res: any) => {
      testFinish();

      expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
      data.table1.map((row: any, index: number) => {
        expect(res.table1[index][0]).to.be.equal(data.table1[index].col1);
        expect(res.table1[index][1]).to.be.equal(data.table1[index].col2);
        expect(res.table1[index][2]).to.be.equal(data.table1[index].col3);
        expect(res.table1[index][3]).to.be.equal(data.table1[index].col4);
      });
      done();
    });
  });

  it("OBJ, multiple rows with nulls", done => {
    testStart();

    const data: any = {
      table1: [
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: 1.62, col3: "x", col4: "x" },
        { col1: 42, col2: 1.62, col3: "x", col4: "x" }
      ]
    };
    adapter.request("common/sendObj", data).then((res: any) => {
      testFinish();

      expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
      data.table1.map((row: any, index: number) => {
        expect(res.table1[index].COL1).to.be.equal(data.table1[index].col1);
        expect(res.table1[index].COL2).to.be.equal(data.table1[index].col2);
        expect(res.table1[index].COL3).to.be.equal(data.table1[index].col3);
        expect(res.table1[index].COL4).to.be.equal(data.table1[index].col4);
      });
      done();
    });
  });

  it("ARR, column with all nulls", done => {
    testStart();

    const data: any = {
      table1: [
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" }
      ]
    };
    adapter.request("common/sendArr", data).then((res: any) => {
      testFinish();

      expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
      data.table1.map((row: any, index: number) => {
        expect(res.table1[index][0]).to.be.equal(data.table1[index].col1);
        expect(res.table1[index][1]).to.be.equal(data.table1[index].col2);
        expect(res.table1[index][2]).to.be.equal(data.table1[index].col3);
        expect(res.table1[index][3]).to.be.equal(data.table1[index].col4);
      });
      done();
    });
  });

  it("OBJ, column with all nulls", done => {
    testStart();

    const data: any = {
      table1: [
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" }
      ]
    };
    adapter.request("common/sendObj", data).then((res: any) => {
      testFinish();

      expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
      data.table1.map((row: any, index: number) => {
        expect(res.table1[index].COL1).to.be.equal(data.table1[index].col1);
        expect(res.table1[index].COL2).to.be.equal(data.table1[index].col2);
        expect(res.table1[index].COL3).to.be.equal(data.table1[index].col3);
        expect(res.table1[index].COL4).to.be.equal(data.table1[index].col4);
      });
      done();
    });
  });

  it("ARR, char column with nulls", done => {
    testStart();

    const data: any = {
      table1: [
        { col1: 42, col2: null, col3: "x", col4: null },
        { col1: 42, col2: null, col3: "x", col4: null },
        { col1: 42, col2: null, col3: "x", col4: null },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" }
      ]
    };
    adapter.request("common/sendArr", data).then((res: any) => {
      testFinish();

      expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
      data.table1.map((row: any, index: number) => {
        expect(res.table1[index][0]).to.be.equal(data.table1[index].col1);
        expect(res.table1[index][1]).to.be.equal(data.table1[index].col2);
        expect(res.table1[index][2]).to.be.equal(data.table1[index].col3);
        expect(res.table1[index][3]).to.be.equal("");
      });
      done();
    });
  });

  it("OBJ, char column with nulls", done => {
    testStart();

    const data: any = {
      table1: [
        { col1: 42, col2: null, col3: "x", col4: null },
        { col1: 42, col2: null, col3: "x", col4: null },
        { col1: 42, col2: null, col3: "x", col4: null },
        { col1: 42, col2: null, col3: "x", col4: "" },
        { col1: 42, col2: null, col3: "x", col4: "" }
      ]
    };
    adapter.request("common/sendObj", data).then((res: any) => {
      testFinish();

      expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
      data.table1.map((row: any, index: number) => {
        expect(res.table1[index].COL1).to.be.equal(data.table1[index].col1);
        expect(res.table1[index].COL2).to.be.equal(data.table1[index].col2);
        expect(res.table1[index].COL3).to.be.equal(data.table1[index].col3);
        expect(res.table1[index].COL4).to.be.equal("");
      });
      done();
    });
  });

  it("ARR, special chars(tab, CRLF, CR, UTF8)", done => {
    testStart();

    const data: any = {
      table1: [
        {
          col1: "\t",
          col2: "\r\n",
          col3: "\r",
          col4: "传/傳"
        }
      ]
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
