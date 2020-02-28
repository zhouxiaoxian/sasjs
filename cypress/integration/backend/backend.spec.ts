/// <reference types="cypress" />
import SASjs from '../../../src/index';

const adapter = new SASjs({
    serverUrl: "",
    port: null,
    pathSAS9: "/SASStoredProcess/do",
    pathSASViya: "/SASJobExecution",
    appLoc: "/Public/app",
    serverType: "SAS9",
    debug: true
});

context('Testing SAS', () => {
    it('User login', (done) => {
        let userLoggedIn = false;

        adapter.SASlogin("", "")
            .then(res => {
                if (res.includes("You have signed in") ||
                    res.includes("User already logged in")) {
                        userLoggedIn = true;
                    }

                expect(userLoggedIn, "Login result").to.true;
                done();
            }, err => {
                console.log(err);
                done("User not logged");
            });
    });

    it('Should make request', (done) => {
        let data = {
            sometable: [
                {firstCol: 'first col value'}
            ]
        }

        let excpectedData = [
            ["first col value"]
        ]

        let jsonResponse: any = null;

        adapter.request("common/sendArr", data).then(
            res => {
                try {
                    jsonResponse = JSON.parse(res);
                } catch(e) {
                    console.log(e);
                    done("Response is not json");
                }

                // expect(JSON.stringify(jsonResponse.sometable)).to.be.equal(JSON.stringify(excpectedData));
                
                if (JSON.stringify(jsonResponse.sometable) === JSON.stringify(excpectedData)) {
                    done();
                } else {
                    done("Response is not as excpected");
                }
            }, err => {
                console.error(err);
                done("Request failed");
        })
    });
})
  