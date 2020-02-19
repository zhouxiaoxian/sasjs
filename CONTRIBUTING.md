# Contributing

Contributions to SASjs are very welcome!  When making a PR, test cases should be included.  To help in unit testing, be sure to run the following when making changes:

```
# the following creates a tarball in the build folder of SASjs
npm run-script package:lib

# now go to your app and run:
npm install ../sasjs/build/<tarball filename>
```
