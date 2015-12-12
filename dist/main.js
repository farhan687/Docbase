
// FILE: scripts/docbase-html-mode.js
/**
 *
 * Docbase engine
 * Appbase
 * MIT license
 *
 */

(function($, angular) {
    /*
     * Scrollspy.
     */
    $(function() {
        $("h2, h3").scrollagent(function(cid, pid, currentElement, previousElement) {
            if (pid) {
                $("[href*='#" + pid + "']").removeClass('active');
            }
            if (cid) {
                $("[href*='#" + cid + "']").addClass('active');
            }
        });
    });
})(window.jQuery, window.angular);

// FILE: scripts/docbase.js
/**
 *
 * Docbase engine
 * Appbase
 * Henrique Sa, Feb '15
 * MIT license
 *
 */

(function($, angular) {

    var jWindow = $(window);
    var angApp = angular.module('docbaseApp', ['ngRoute']);

    var exports = this;
    var Docbase = exports.Docbase = {};
    var Events = Docbase.events = {};
    var Route = Docbase.route = {};

    /**
     * Github offers an API with a very strict, non-increasable limit for the client side.
     * Docbase uses this API to make a map of your markdown files, and then fetches
     * them through get requests to GitHub Pages, not the API. As there is a small chance
     * the GitHub quota will be exceeded before the docs are mapped, keep a map file (JSON)
     * in the root of your site so that can be fetched.
     * Only use HTML5 mode if you're hosting it yourself, requires server config.
     */

    Docbase.methods = ['file', 'github', 'generic'];
    var _run = function(options){
      var defaults = {
          method: 'github',
          searchIndexUrl: 'search-index.json',
          map: {
              file: 'map.json',
              path: ''
          },
          file: {
              path: 'docs'
          },
          github: {
              /*user: 'user',
              repo: 'repo',*/
              path: '/',
              branch: 'gh-pages',
              editGithubBtn: true
          },
          generic: {
              baseurl: '',
              path: '/'
          },
          html5mode: false,
          indexType: 'html',
          indexSrc: 'v1/path/index.md',
          indexHtml: 'html/main.html', // dochub entry page
          flatdocHtml: 'html/flatdoc.html', // top navbar, and markdown layouts
          angularAppName: 'docbaseApp'
      };

      options = $.extend({}, defaults, options);

      if (options.method === 'github') {
          if (!options.github.user || !options.github.repo) {
              throw 'Missing GitHub user/repo info.';
          }
      }

      // Removes trailing '/'s.
      Docbase.methods.forEach(function(method) {
          var properties = options[method];
          Object.keys(properties).forEach(function(key) {
              properties[key] = cutTrailingSlashes(properties[key]);
          });
      });
      options.map.path = cutTrailingSlashes(options.map.path);

      Docbase.options = options;

      Events.bind();

        angApp.factory('FlatdocService', ['$q', '$route', '$location', '$anchorScroll', '$http', Route.fetch])
          .controller('URLCtrl', ['$scope', '$location', '$filter', 'data', 'commits', Route.URLCtrl])
          .controller('MainCtrl', ['$scope', '$location', '$timeout', Route.mainCtrl])
          .config(['$routeProvider', '$locationProvider', Route.config])
          .run(
              ['$rootScope', '$location', '$routeParams', '$anchorScroll',
                  '$route', Route.anchorConfig
              ]
          );

      if (options.method === 'file') {
          Docbase.file(options.map);
      } else if (options.method === 'github') {
          Docbase.github(options.github);
      } else {
          Docbase.file(options.map);
      }
    };
    Docbase.run = function(options) {
        if(options instanceof String || options === undefined){
          $.get(options || 'docbase.json').then(function(data){
            _run(data);
          });
        }else{
          _run(options);
        }
    };

    Docbase.github = function(options) {
        githubTree(options, function(error, map) {
            if (error) {
                Docbase.file(Docbase.options.map);
            } else if (checkSchema(map)) {
                Docbase.map = map;
                $.get(Docbase.options.map.path + '/' + Docbase.options.map.file)
                    .success(function(fileMap) {
                        var ghMap = Docbase.map;
                        var fileMapVer = Object.keys(fileMap);
                        fileMapVer.forEach(function(fileVer) {
                            if (ghMap[fileVer]) {
                                ghMap[fileVer].forEach(function(category) {
                                    var categoryM = fileMap[fileVer].filter(function(_category) {
                                        return _category.name === category.name;
                                    })[0];
                                    if (categoryM && categoryM.label) {
                                        category.label = categoryM.label;

                                        category.files.forEach(function(file) {
                                            var fileM = categoryM.files.filter(function(_file) {
                                                return _file.name === file.name;
                                            })[0];
                                            if (fileM && fileM.label) file.label = fileM.label;
                                        });
                                    }

                                });
                            }
                        });
                        jWindow.trigger('mapped');
                        Events.bind();
                    })
                    .error(function(error) {
                        // no map available for labels
                        jWindow.trigger('mapped');
                        Events.bind();
                    });
            } else {
                throw 'GitHub tree mapping error.';
            }
        });

    };

    Docbase.file = Docbase.generic = function(options) {
        $.get(options.path + '/' + options.file)
            .success(function(map) {
                if (checkSchema(map)) {
                    var v = Object.keys(map);
                    if (v.length && map[v[0]][0].files.length && map[v[0]][0].files[0].name) {
                        Docbase.map = map;
                        jWindow.trigger('mapped');
                        Events.bind();
                    } else {
                        throw 'Map does not have a file entry. Check the documentation';
                    }
                } else {
                    throw 'Map file schema error. Check the documentation.';
                }
            })
            .error(function(error) {
                throw error;
            });
    };


    Events.switchBind = function(state) {
        jWindow[state]('flatdoc:ready', Events.ready);
        jWindow[state]('ajaxError', Events.ajaxError);
    };

    Events.bind = function() {
        Events.switchBind('on');
    };

    Events.unbind = function() {
        Events.switchBind('off');
    };

    Events.ready = function() {
        jWindow.trigger('docbase:ready');
    };

    Events.ajaxError = function(event, request) {
        if (request.status === 403 && Docbase.options.method === 'github') {
            console.error('Github API quota exceeded.');
        }
    };

    Route.config = function($routeProvider, $location, $rootScope, $anchorScroll) {
        var flatdocURL = Docbase.options.flatdocHtml;
        var mainURL = Docbase.options.indexHtml;
        var resolve = {
            data: function(FlatdocService) {
                return FlatdocService.getData().then(function(data) {
                    return data;
                });
            },
            commits: function(FlatdocService) {
                return FlatdocService.getCommits();
            }
        };

        $routeProvider
            .when('/:version/:folder/:file', {
                templateUrl: flatdocURL,
                controller: 'URLCtrl',
                resolve: resolve
            })
            .when('/:version/:folder', {
                templateUrl: flatdocURL,
                controller: 'URLCtrl',
                resolve: resolve
            })
            .when('/:version', {
                templateUrl: flatdocURL,
                controller: 'URLCtrl',
                resolve: resolve
            })
            .when('/', {
                templateUrl: mainURL,
                controller: 'MainCtrl'
            })
            .otherwise({
                redirectTo: '/'
            });
        $location.html5Mode(Docbase.options.html5mode);
    };

    Route.anchorConfig = function($rootScope, $location, $routeParams, $anchorScroll, $route) {

        /**
         * Hack to prevent route reload when hash is changed.
         * Makes sure only the hash was change and intercepts the event.
         */

        $rootScope.$on('$locationChangeStart', function(evnt, newRoute, oldRoute) {
            var firstRoute = newRoute.split('#');
            var hash = firstRoute[firstRoute.length - 1];

            firstRoute.splice(firstRoute.length - 1, 1);
            firstRoute = firstRoute.join('#');

            var secondRoute = oldRoute.split('#');
            secondRoute.splice(secondRoute.length === 2 ? 2 : secondRoute.length - 1, 1);
            secondRoute = secondRoute.join('#');

            if (firstRoute === secondRoute && (newRoute !== oldRoute)) {

                $location.hash(hash);
                var lastRoute = $route.current;
                var unbind = $rootScope.$on('$locationChangeSuccess', function() {
                    $route.current = lastRoute;
                    unbind();
                });
                $anchorScroll();
            }
        });

        $rootScope.$on("$includeContentLoaded", function(event, templateName) {
            if($.fn.searchAppbase){
                $('.search_field').searchAppbase(Docbase.options.searchIndexUrl);
            }
        });

        /**
         * Initial scroll to hash on page load.
         */

        $rootScope.$on('$routeChangeSuccess', function(newRoute, oldRoute) {
            jWindow.on('docbase:ready', function() {
                $anchorScroll();
                $('.content').find('pre code').each(function() {
                    $(this).addClass("prettyprint");
                });
                prettyPrint();
            });
        });
    };

    Route.fetch = function($q, $route, $location, $anchorScroll, $http) {
        function fetcher() {
            var deferred = $q.defer();
            var options = Docbase.options;

            if (Docbase.map) {
                mapLoaded();
            } else {
                jWindow.on('mapped', mapLoaded);
            }

            function mapLoaded() {
                var map = Docbase.map;
                var retObj = {};
                var currentVersion = $route.current.params.version;
                var versions = Object.keys(map);
                var location = Route.updatePath($route.current.params);

                retObj.versions = versions;
                retObj.currentVersion = currentVersion || versions[versions.length - 1];
                retObj.map = map;
                retObj.locationPath = location.path;

                if (!location.fail) {
                    var options = Docbase.options;
                    var gh = Docbase.options.github;
                    var url = 'https://github.com/' + gh.user + '/' + gh.repo + '/tree/' + gh.branch + '/' + gh.path + location.path + '.md';

                    // file URL should be fetched remotely if hosted on github or elsewhere.
                    var fileURL = options.file.path + location.path + '.md';
                    if (options.method === 'github')
                        fileURL = 'https://raw.githubusercontent.com/' + gh.user + '/' + gh.repo + '/' + gh.branch + '/' + gh.path + location.path + '.md';
                    else if (options.method === 'generic')
                        fileURL = options.generic.baseurl + '/' + options.generic.path + location.path + '.md';
                    retObj.github = url;

                    Events.parsed = false;
                    Flatdoc.file(fileURL)(function(err, markdown) {
                        markdown = markdown.split('\n');
                        var obj = markdown.shift();
                        obj = obj.replace(/\u201D/g, '"');
                        obj = obj.replace(/\u201C/g, '"');

                        try {
                            obj = JSON.parse(obj);
                        } catch (e) {
                            markdown.unshift(obj);
                            obj = {
                                'threeColumns': false
                            };
                        }

                        markdown = markdown.join('\n');

                        if (obj.threeColumns) {
                            $('body').removeClass('no-literate');
                        } else {
                            $('body').addClass('no-literate');
                        }
                        if (obj.bigh3) {
                            $('body').addClass('big-h3');
                        } else {
                            $('body').removeClass('big-h3');
                        }
                        if (obj.largeBrief) {
                            $('body').addClass('large-brief');
                        } else {
                            $('body').removeClass('large-brief');
                        }

                        var data = Flatdoc.parser.parse(markdown, function(code) {
                            return Flatdoc.highlighters.generic(code);
                        });
                        retObj.markdown = data;
                        deferred.resolve(retObj);
                    });

                } else {
                    retObj.github = false;
                    deferred.resolve(retObj);
                }
            }
            return deferred.promise;
        }

        return {
            getData: function() {
                return new fetcher();
            },
            getCommits: function() {
                var resultPromise = null;
                var options = Docbase.options;
                var file_path = $route.current.params;
                if (options.github.path) {
                    var full_path = options.github.path + '/' + file_path.version + '/' + file_path.folder + '/' + file_path.file;
                    resultPromise = $http.get('https://api.github.com/repos/' + options.github.user + '/' + options.github.repo + '/commits?path=' + full_path + '.md');
                } else {
                    deferred = $q.defer();
                    resultPromise = deferred.promise;
                    deferred.resolve([]);
                }
                return resultPromise;
            }
        };
    };

    Route.URLCtrl = function($scope, $location, $filter, data, commits) {
        $location.path(data.locationPath);
        var contribut_array = [];
        if (!data.fail) {
            $scope.versions = data.versions;
            $scope.currentVersion = data.currentVersion;
            $scope.map = data.map;
            $scope.github = data.github;

            var content = data.markdown;
            $('[role="flatdoc-content"]').html(content.content.find('>*'));
            $('[role="flatdoc-menu"]').html(Flatdoc.menuView(content.menu));

            jWindow.trigger('flatdoc:ready');
        }

        var extra_container = $("<div>").addClass('extra_container');
        if (commits.status == 200 && commits.data && commits.data.length) {
            var commits_data = commits.data;
            var commiter_data = $filter('date')(commits.data[0].commit.committer.date, 'mediumDate');
            var last_date = $('<span>').addClass('pull-right modified-date').html('Last Modified On : <a href="' + commits.data[0].html_url + '">' + commiter_data + '</a>');

            var contributors_data = commits_data;
            var contributors = $('<div>').addClass('contributor-container');
            for (var i = 0; i < contributors_data.length; i++) {
                var contributor_d = contributors_data[i].committer;
                if (contributor_d && jQuery.inArray(contributor_d.login, contribut_array) == -1) {
                    contribut_array.push(contributor_d.login);
                    var contributor_img = $('<img>').addClass('contributor_img img-rounded').attr({
                        'src': contributor_d.avatar_url,
                        'alt': contributor_d.login
                    });
                    var contributor = $('<a>').addClass('contributor').attr({
                        'href': contributor_d.html_url,
                        'title': contributor_d.login,
                        'target': '_blank'
                    }).append(contributor_img);
                    contributors.append(contributor);
                }
            }
            var contributors_header = $('<div>').addClass('contributors_header').append('Contributors').append(last_date);
            $(extra_container).prepend(contributors).prepend(contributors_header);


        }

        var div2 = $('<div>').addClass('clearFix');
        $('[role="flatdoc-content"]').prepend(div2).prepend(extra_container);

    };

    Route.mainCtrl = function($scope, $location, $timeout) {
        if (Docbase.options.indexType === 'markdown') {
            var path = Docbase.options.indexSrc;
            if (endsWith(path, '.md')) {
                path = path.substring(0, path.length - 3);
            }
            if (path.charAt(0) !== '/') {
                path = '/' + path;
            }

            $location.path(path);
        } else {
            var onMapped = function() {
                $timeout(function() {
                    $scope.map = Docbase.map;
                    $scope.versions = Object.keys($scope.map);
                    $scope.currentVersion = $scope.versions[0];
                });
            };
            if (Docbase.map) {
                onMapped();
            } else {
                jWindow.on('mapped', onMapped);
            }
        }
    };

    Route.updatePath = function(params) {
        var map = Docbase.map;
        var version = params.version;
        var folder = params.folder;
        var file = params.file;

        if (!map[version]) {
            console.error('Version not mapped.');
            return {
                path: '/',
                fail: true
            };
        }

        var mapFolder;
        if (folder) {
            mapFolder = map[version].filter(function(folders) {
                return folders.name === folder;
            });
            if (!mapFolder.length) {
                console.error('Folder not mapped.');
                return {
                    path: '/' + version,
                    fail: true
                };
            }
        }
        if (file) {
            var mapFile = mapFolder[0].files.filter(function(files) {
                return files.name === file;
            });
            if (!mapFile.length) {
                console.error('File not mapped.');
                return {
                    path: '/' + version + '/' + file,
                    fail: true
                };
            }
        }

        folder = folder || map[version][0].name;
        var folderObj = map[version].filter(function(each) {
            return each.name === folder;
        })[0];

        // allow files in TL menu
        file = file || (folderObj.files && folderObj.files[0].name);
        var path = '/' + version + '/' + folder + '/' + file;
        if (typeof(file) === "undefined")
            path = '/' + version + '/' + folder;

        return {
            path: path,
            fail: false
        };
    };

    function cutTrailingSlashes(value) {
        if (!angular.isString(value)) {
            return value;
        }

        value = value.charAt(0) === '/' ? value.substring(1) : value;
        return endsWith(value, '/') ? value.substring(0, value.length - 1) : value;
    }

    function checkSchema(map) {
        return schema({
            '*': Array.of(schema({
                name: String,
                label: String
                    /*,
                                    files: Array.of(schema({
                                        name: String,
                                        label: String
                                    }))*/
            }))
        })(map);
    }

    function githubTree(options, callback) {
        var full_path = options.path;

        var path = full_path.split('/');
        var deleted = path.splice(path.length - 1, 1);
        path.join('/');
        deleted = deleted[0];

        var baseurl = 'https://api.github.com/repos/' + options.user + '/' + options.repo + '/';

        var url = baseurl + 'contents/' + path;

        $.get(url, {
                ref: options.branch
            })
            .success(function(data) {

                var commitData = data.filter(function(each) {
                    return each.name === deleted;
                });
                if (commitData[0]) {
                    var sha = commitData[0].sha;
                    $.get(baseurl + 'git/trees/' + sha + '?recursive=1')
                        .success(function(tree) {
                            tree = tree.tree.filter(function(each) {
                                return endsWith(each.path, '.md');
                            });

                            var map = {};

                            tree.forEach(function(each) {
                                var sub_path = each.path.split('/');
                                /* assuming sub_path[0] is the version,
                                 * sub_path[1] is the folder,
                                 * and sub_path[2] is the file.
                                 */
                                if (sub_path.length >= 3) {
                                    var version = sub_path[0];
                                    var folder = sub_path[1];
                                    var file = sub_path[2].substring(0, sub_path[2].length - 3);

                                    // Version is new
                                    if (!map[version]) {
                                        map[version] = [];
                                    }

                                    // Folder is new
                                    if (!map[version].filter(function(a) {
                                            return a.name === folder;
                                        }).length) {
                                        map[version].push({
                                            label: folder,
                                            name: folder,
                                            files: []
                                        });
                                    }

                                    // Add file
                                    map[version].forEach(function(each) {
                                        if (each.name === folder)
                                            each.files.push({
                                                name: file,
                                                label: file
                                            });
                                    });
                                }
                            });

                            callback(null, map);

                        })
                        .error(function(error) {
                            callback(error);
                        });
                }
            })
            .error(function(error) {
                callback(error);
            });
    }

    /**
     * endsWith polyfill, from MDN
     * Created by Ripter, last edited by Mathias Bynens
     */
    function endsWith(subjectString, searchString, position) {
        if (position === undefined || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    }
})(window.jQuery, window.angular);


// FILE: scripts/flatdoc-theme.js
/**
 * Official flatdoc theme
 * modified
 */

(function($) {
  var $window = $(window);
  var $document = $(document);

  $window.on('docbase:ready', runTheme);

  function runTheme() {

    $("h2, h3").scrollagent({
      offset: 100
    }, function(cid, pid, currentElement, previousElement) {
      if (pid) {
        $("[pref='#" + pid + "']").removeClass('active');
      }
      if (cid) {
        $("[pref='#" + cid + "']").addClass('active');
      }
    });

    $('.menu a').each(function() {
      var el = $(this);
      var href = el.attr('href');

      if (href && !el.attr('pref')) {
        var location = window.location.href.split('#');
        if (location.length <= 2) {
          location = location.join('#') + href;
        } else {
          location[location.length - 1] = href.substring(1);
          location = location.join('#');
        }
        el.attr('href', location);
        el.attr('pref', href);
      }
    });

    var $sidebar = $('.menubar');
    var elTop;

    $window
      .on('resize.sidestick', function() {
        $sidebar.removeClass('fixed');
        elTop = $sidebar.offset().top;
        $window.trigger('scroll.sidestick');
      })
      .on('scroll.sidestick', function() {
        var scrollY = $window.scrollTop();
        $sidebar.toggleClass('fixed', (scrollY >= elTop - 35));
      })
      .trigger('resize.sidestick');

  }

})(window.jQuery);


/*! jQuery.scrollagent (c) 2012, Rico Sta. Cruz. MIT License.
 *  https://github.com/rstacruz/jquery-stuff/tree/master/scrollagent */

// Call $(...).scrollagent() with a callback function.
//
// The callback will be called everytime the focus changes.
//
// Example:
//
//      $("h2").scrollagent(function(cid, pid, currentElement, previousElement) {
//        if (pid) {
//          $("[href='#"+pid+"']").removeClass('active');
//        }
//        if (cid) {
//          $("[href='#"+cid+"']").addClass('active');
//        }
//      });

(function($) {

  $.fn.scrollagent = function(options, callback) {
    var $window = $(window);

    // Account for $.scrollspy(function)
    if (typeof callback === 'undefined') {
      callback = options;
      options = {};
    }

    var $sections = $(this);
    var $parent = options.parent || $(window);

    // Find the top offsets of each section
    var offsets = [];
    $sections.each(function(i) {
      var offset = ($(this).attr('data-anchor-offset') ?
        parseInt($(this).attr('data-anchor-offset'), 10) :
        (options.offset || 0));

      offsets.push({
        id: $(this).attr('id'),
        index: i,
        el: this,
        offset: offset
      });
    });

    // State
    var current = null;
    var height = null;
    var range = null;

    // Save the height. Do this only whenever the window is resized so we don't
    // recalculate often.
    function refreshSize() {
      height = $parent.height();
      range = $(document).height();
    }

    // Find the current active section every scroll tick.
    function refreshScroll() {
      var y = $parent.scrollTop();
      y += height * (0.3 + 0.7 * Math.pow(y / range, 2));

      var latest = null;

      for (var i in offsets) {
        if (offsets.hasOwnProperty(i)) {
          var offset = offsets[i];
          if ($(offset.el).offset().top + offset.offset < y) latest = offset;
        }
      }

      if (latest && (!current || (latest.index !== current.index))) {
        callback.call($sections,
          latest ? latest.id : null,
          current ? current.id : null,
          latest ? latest.el : null,
          current ? current.el : null);
        current = latest;
      }
    }

    $window.on('scroll', $.throttle(50, refreshScroll));
    $window.on('resize', $.throttle(250, refreshSize));

    refreshSize();
    refreshScroll();

    return this;
  };

})(jQuery);

/*
 * jQuery throttle / debounce - v1.1 - 3/7/2010
 * http://benalman.com/projects/jquery-throttle-debounce-plugin/
 * 
 * Copyright (c) 2010 "Cowboy" Ben Alman
 * Dual licensed under the MIT and GPL licenses.
 * http://benalman.com/about/license/
 */
(function(b, c) {
  var $ = b.jQuery || b.Cowboy || (b.Cowboy = {}),
    a;
  $.throttle = a = function(e, f, j, i) {
    var h, d = 0;
    if (typeof f !== "boolean") {
      i = j;
      j = f;
      f = c;
    }

    function g() {
      var o = this,
        m = +new Date() - d,
        n = arguments;

      function l() {
        d = +new Date();
        j.apply(o, n);
      }

      function k() {
        h = c;
      }
      if (i && !h) {
        l();
      }
      h && clearTimeout(h);// jshint ignore:line
      if (i === c && m > e) {
        l();
      } else {
        if (f !== true) {
          h = setTimeout(i ? k : l, i === c ? e - m : e);
        }
      }
    }
    if ($.guid) {
      g.guid = j.guid = j.guid || $.guid++;
    }
    return g;
  };
  $.debounce = function(d, e, f) {
    return f === c ? a(d, e, false) : a(d, f, e !== false);
  };
})(this);

// FILE: scripts/polyfill.js
if (!Function.prototype.bind) {
    Function.prototype.bind = function bind(that) { // .length is 1
        var slice = [].slice;
        var Empty = function() {};
        var target = this;
        if (typeof target != "function") {
            throw new TypeError("Function.prototype.bind called on incompatible " + target);
        }
        var args = slice.call(arguments, 1); // for normal call
        var bound = function() {

            if (this instanceof bound) {

                var result = target.apply(
                    this,
                    args.concat(slice.call(arguments))
                );
                if (Object(result) === result) {
                    return result;
                }
                return this;

            } else {
                return target.apply(
                    that,
                    args.concat(slice.call(arguments))
                );

            }

        };
        if (target.prototype) {
            Empty.prototype = target.prototype;
            bound.prototype = new Empty();
            Empty.prototype = null;
        }
        return bound;
    };
}

// FILE: scripts/searchAppbase.js
(function($) {
	$.fn.searchAppbase = function(searchIndexUrl) {
		var $search = this;
		$search.addClass('appbase-search');

		function searchTag(data) {
			var result_a = $('<a>').addClass('result_record_a').attr('href', data.link).text(data.title);
			var result_div = $('<div>').addClass('result_record').append(result_a);
			return result_div;
		}
		var fail = function(e) {
			console.error("Your search index wasn't loaded, please check the following error", e);
		};
		var success = function(searchData) {
			searchData.forEach(function(searchSingle) {
				searchSingle.content = searchSingle.content.replace(/<\/?[^>]+(>|$)/g, " ");
			});

			var posts = new Bloodhound({
				datumTokenizer: Bloodhound.tokenizers.obj.whitespace('title', 'content'),
				queryTokenizer: Bloodhound.tokenizers.whitespace,
				local: searchData
			});

			$search.typeahead({
				minLength: 1
			}, {
				name: 'titles',
				displayKey: 'title',
				source: posts,
				templates: {
					pending: true,
					suggestion: function(data) {
						if (data) {
							var single_record = searchTag(data);
							return single_record;
						} else
							return;
					}
				}
			});

			$search.bind('typeahead:select', function(ev, suggestion) {
				window.location.href = suggestion.link;
			});
			$search.bind('typeahead:open', function(ev, suggestion) {
				$search.parents('.search-form').addClass('open');
			});
			$search.bind('typeahead:close', function(ev, suggestion) {
				$search.parents('.search-form').removeClass('open');
			});
		};

		//Fetch search index json data
		var intializeCall = function() {
			$.get(searchIndexUrl)
				.then(success)
				.fail(fail);
		};

		//Load typeahead.js
		var Loader = function() {};
		Loader.prototype = {
			require: function(scripts, callback) {
				this.loadCount = 0;
				this.totalRequired = scripts.length;
				this.callback = callback;

				for (var i = 0; i < scripts.length; i++) {
					var split_name = scripts[i].split('.');
					if (split_name[split_name.length - 1] == 'js')
						this.writeScript(scripts[i]);
					if (split_name[split_name.length - 1] == 'css')
						this.writeStylesheet(scripts[i]);
				}
			},
			loaded: function(evt) {
				this.loadCount++;

				if (this.loadCount == this.totalRequired && typeof this.callback == 'function') this.callback.call();
			},
			writeScript: function(src) {
				var self = this;
				var s = document.createElement('script');
				s.type = "text/javascript";
				s.async = true;
				s.src = src;
				s.addEventListener('load', function(e) {
					self.loaded(e);
				}, false);
				var head = document.getElementsByTagName('head')[0];
				head.appendChild(s);
			},
			writeStylesheet: function(src) {
				var self = this;
				var s = document.createElement('link');
				s.type = "text/css";
				s.rel = "stylesheet";
				s.href = src;
				s.addEventListener('load', function(e) {
					self.loaded(e);
				}, false);
				var head = document.getElementsByTagName('head')[0];
				head.appendChild(s);
			}
		};

		var jquery_js = new Loader();
		jquery_js.require([
				"http://twitter.github.io/typeahead.js/releases/latest/typeahead.bundle.js"
			],
			function() {
				intializeCall();
			});

	};
}(jQuery));