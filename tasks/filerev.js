'use strict';
var crypto = require('crypto');
var path = require('path');
var fs = require('fs');
var chalk = require('chalk');
var eachAsync = require('each-async');

module.exports = function (grunt) {
  grunt.registerMultiTask('filerev', 'File revisioning based on content hashing', function () {
    var options = this.options({
      algorithm: 'md5',
      length: 8
    });
    var target = this.target;
    var filerev = grunt.filerev || {summary: {}};

    eachAsync(this.files, function (el, i, next) {
      var move = true;

      // If dest is furnished it should indicate a directory
      if (el.dest) {
        // When globbing is used, el.dest contains basename, we remove it
        if (el.orig.expand) {
          el.dest = path.dirname(el.dest);
        }

        try {
          var stat = fs.lstatSync(el.dest);
          if (stat && !stat.isDirectory()) {
            grunt.fail.fatal('Destination ' + el.dest  + ' for target ' + target + ' is not a directory');
          }
        } catch (err) {
          grunt.log.writeln('Destination dir ' + el.dest + ' does not exists for target ' + target + ': creating');
          grunt.file.mkdir(el.dest);
        }
        // We need to copy file as we now have a dest different from the src
        move = false;
      }

      el.src.forEach(function (file) {
        if (grunt.file.isDir(file)) {
          return;
        }

        var dirname;
        var hash = crypto.createHash(options.algorithm).update(fs.readFileSync(file)).digest('hex');
        var suffix = hash.slice(0, options.length);
        var ext = path.extname(file);
        var newName = [path.basename(file, ext), suffix, ext.slice(1)].join('.');
        var resultPath;

        if (move) {
          dirname = path.dirname(file);
          resultPath = path.resolve(dirname, newName);
          fs.renameSync(file, resultPath);
        } else {
          dirname = el.dest;
          resultPath = path.resolve(dirname, newName);
          grunt.file.copy(file, resultPath);
        }

        // Source maps
        var sourceMap = false;
        if (ext === '.js' || ext === '.css') {
            var mapFile = file + '.map';
            var mapResultPath = resultPath + '.map';
            if (grunt.file.exists(mapFile)) {
                if (move) {
                    fs.renameSync(mapFile, mapResultPath);
                } else {
                    grunt.file.copy(mapFile, mapResultPath);
                }

                var contents = grunt.file.read(resultPath);
                contents = contents.replace(/sourceMappingURL=.*js\.map/, 'sourceMappingURL=' + newName);
                grunt.file.write(resultPath, contents);

                sourceMap = true;
           }
        }

        filerev.summary[path.normalize(file)] = path.join(dirname, newName);
        grunt.log.writeln(chalk.green('✔ ') + file + chalk.gray(' changed to ') + newName);
        if (sourceMap) {
            filerev.summary[path.normalize(file + '.map')] = path.join(dirname, newName + '.map');
            grunt.log.writeln(chalk.green('✔ ') + file + '.map' + chalk.gray(' changed to ') + newName + '.map');
            grunt.log.writeln(chalk.green('✔ ') + file + ' has its sourcemap reference updated');
        }

      });

      next();
    }, this.async());

    grunt.filerev = filerev;
  });
};
