// @ts-check
(function () {
    'use strict';

    angular.module('ariaNg').factory('ariaNgFileService', ['$window', function ($window) {
        var isSupportFileReader = !!$window.FileReader;
        var isSupportBlob = !!$window.Blob;

        var getAllowedExtensions = function (fileFilter) {
            var extensions = [];

            if (!fileFilter || fileFilter.length < 1) {
                extensions.push(/.+$/);
                return extensions;
            }

            var fileFilters = fileFilter.split(',');

            for (var i = 0; i < fileFilters.length; i++) {
                var extension = fileFilters[i];

                if (extension === '*.*') {
                    extensions.push(/.+$/);
                    continue;
                }

                extension = extension.replace('.', '\\.');
                extension = extension + '$';

                extensions.push(new RegExp(extension));
            }

            return extensions;
        };

        var checkFileExtension = function (fileName, extensions) {
            if (!extensions || extensions.length < 1) {
                return true;
            }

            for (var i = 0; i < extensions.length; i++) {
                if (extensions[i].test(fileName)) {
                    return true;
                }
            }

            return false;
        };

        var decodeTorrent = (function () {
            // 修改自：https://github.com/themasch/node-bencode/blob/master/lib/decode.js

            var INTEGER_START = 0x69 // 'i'
            var STRING_DELIM = 0x3A // ':'
            var DICTIONARY_START = 0x64 // 'd'
            var LIST_START = 0x6C // 'l'
            var END_OF_TYPE = 0x65 // 'e'

            /**
             * @param {Uint8Array} buffer
             * @param {Number} start
             * @param {Number} end
             * @return {Number} calculated number
             */
            function getIntFromBuffer(buffer, start, end) {
                var sum = 0
                var sign = 1

                for (var i = start; i < end; i++) {
                    var num = buffer[i]

                    if (num < 58 && num >= 48) {
                        sum = sum * 10 + (num - 48)
                        continue
                    }

                    if (i === start && num === 43) { // +
                        continue
                    }

                    if (i === start && num === 45) { // -
                        sign = -1
                        continue
                    }

                    if (num === 46) { // .
                        // its a float. break here.
                        break
                    }

                    throw new Error('not a number: buffer[' + i + '] = ' + num)
                }

                return sum * sign
            }

            /**
             * Decodes bencoded data.
             *
             * @param  {Uint8Array} data
             * @param  {Number=} start (optional)
             * @param  {Number=} end (optional)
             * @return {Object|Array|Uint8Array|String|Number}
             */
            function decode(data, start, end) {
                if (data == null || data.length === 0) {
                    return null
                }

                decode.position = 0

                decode.data = data.slice(start, end)

                decode.bytes = decode.data.length

                return decode.next()
            }

            decode.bytes = 0
            decode.position = 0
            decode.data = null

            decode.next = function () {
                switch (decode.data[decode.position]) {
                    case DICTIONARY_START:
                        return decode.dictionary()
                    case LIST_START:
                        return decode.list()
                    case INTEGER_START:
                        return decode.integer()
                    default:
                        return decode.buffer()
                }
            }

            decode.find = function (chr) {
                var i = decode.position
                var c = decode.data.length
                var d = decode.data

                while (i < c) {
                    if (d[i] === chr) return i
                    i++
                }

                throw new Error(
                    'Invalid data: Missing delimiter "' +
                    String.fromCharCode(chr) + '" [0x' +
                    chr.toString(16) + ']'
                )
            }

            decode.dictionary = function () {
                decode.position++

                var dict = {}

                while (decode.data[decode.position] !== END_OF_TYPE) {
                    var keyBuffer = decode.buffer()
                    var key = decode.Uint8ArrayToString(keyBuffer)
                    dict[key] = decode.next()
                }

                decode.position++

                return dict
            }

            decode.list = function () {
                decode.position++

                var lst = []

                while (decode.data[decode.position] !== END_OF_TYPE) {
                    lst.push(decode.next())
                }

                decode.position++

                return lst
            }

            decode.integer = function () {
                var end = decode.find(END_OF_TYPE)
                var number = getIntFromBuffer(decode.data, decode.position + 1, end)

                decode.position += end + 1 - decode.position

                return number
            }

            decode.buffer = function () {
                var sep = decode.find(STRING_DELIM)
                var length = getIntFromBuffer(decode.data, decode.position, sep)
                var end = ++sep + length

                decode.position = end

                return decode.data.slice(sep, end)
            }

            // 来源：https://stackoverflow.com/a/41798356
            decode.Uint8ArrayToString = (function () {
                var charCache = new Array(128) // Preallocate the cache for the common single byte chars
                var charFromCodePt = String.fromCodePoint || String.fromCharCode
                var result = []

                return function (array) {
                    var codePt, byte1
                    var buffLen = array.length

                    result.length = 0

                    for (var i = 0; i < buffLen;) {
                        byte1 = array[i++]

                        if (byte1 <= 0x7F) {
                            codePt = byte1
                        } else if (byte1 <= 0xDF) {
                            codePt = ((byte1 & 0x1F) << 6) | (array[i++] & 0x3F)
                        } else if (byte1 <= 0xEF) {
                            codePt = ((byte1 & 0x0F) << 12) | ((array[i++] & 0x3F) << 6) | (array[i++] & 0x3F)
                        } else if (String.fromCodePoint) {
                            codePt = ((byte1 & 0x07) << 18) | ((array[i++] & 0x3F) << 12) | ((array[i++] & 0x3F) << 6) | (array[i++] & 0x3F)
                        } else {
                            codePt = 63 // Cannot convert four byte code points, so use "?" instead
                            i += 3
                        }

                        result.push(charCache[codePt] || (charCache[codePt] = charFromCodePt(codePt)))
                    }

                    return result.join("")
                }
            })()

            return decode
        })()

        return {
            isSupportFileReader: function () {
                return isSupportFileReader;
            },
            isSupportBlob: function () {
                return isSupportBlob;
            },
            openFileContent: function (options, successCallback, errorCallback, element) {
                if (!isSupportFileReader) {
                    if (errorCallback) {
                        errorCallback('Your browser does not support loading file!');
                    }

                    return;
                }

                options = angular.extend({
                    fileFilter: null,
                    fileType: 'binary' // or 'text'
                }, options);

                var allowedExtensions = getAllowedExtensions(options.fileFilter);

                if (!element || !element.change) {
                    element = angular.element('<input type="file" style="display: none"/>');
                }

                if (options.fileFilter) {
                    element.attr('accept', options.fileFilter);
                }

                element.val('');

                if (element.attr('data-ariang-file-initialized') !== 'true') {
                    element.change(function () {
                        if (!this.files || this.files.length < 1) {
                            return;
                        }

                        var file = this.files[0];
                        var fileName = file.name;

                        if (!checkFileExtension(fileName, allowedExtensions)) {
                            if (errorCallback) {
                                errorCallback('The selected file type is invalid!');
                            }

                            return;
                        }

                        var reader = new FileReader();

                        reader.onload = function () {
                            var result = {
                                fileName: fileName
                            };

                            switch (options.fileType) {
                                case 'text':
                                    result.content = this.result;
                                    break;
                                case 'binary':
                                default:
                                    result.base64Content = this.result.replace(/.*?base64,/, '');
                                    break;
                            }

                            if (successCallback) {
                                successCallback(result);
                            }
                        };

                        reader.onerror = function () {
                            if (errorCallback) {
                                errorCallback('Failed to load file!');
                            }
                        };

                        switch (options.fileType) {
                            case 'text':
                                reader.readAsText(file);
                                break;
                            case 'binary':
                            default:
                                reader.readAsDataURL(file);
                                break;
                        }
                    }).attr('data-ariang-file-initialized', 'true');
                }

                element.trigger('click');
            },
            saveFileContent: function (content, element, options) {
                if (!isSupportBlob) {
                    return;
                }

                options = angular.extend({
                    fileName: null,
                    contentType: 'application/octet-stream',
                    autoTrigger: false,
                    autoRevoke: false
                }, options);

                var blob = new Blob([content], { type: options.contentType });
                var objectUrl = URL.createObjectURL(blob);

                if (!element) {
                    element = angular.element('<a style="display: none"/>');
                }

                element.attr('href', objectUrl);

                if (options.fileName) {
                    element.attr('download', options.fileName);
                }

                if (options.autoTrigger) {
                    element.trigger('click');
                }

                if (options.autoRevoke) {
                    URL.revokeObjectURL(objectUrl);
                }
            },
            createUint8ArrayFromBase64: function (base64str) {
                var binstr = atob(base64str)
                var arr = new Uint8Array(binstr.length);
                binstr.split('').forEach(function (char, i) {
                    arr[i] = char.charCodeAt(0);
                });
                return arr
            },

            /**
             * @param {Uint8Array} torrent 
             */
            getFilesInTorrent: function (torrent) {
                var torrentInfo = decodeTorrent(torrent).info
                var allFiles = torrentInfo.files
                var name = torrentInfo.name

                var multiDir = false

                /** @type {string[]} */
                var files
                if (!allFiles) {  // 仅包含单个文件
                    files = [decodeTorrent.Uint8ArrayToString(name)]
                } else {
                    files = allFiles.map(function (x) {
                        if (x.path.length > 1) {
                            multiDir = true
                        }

                        return x.path.map(function (p) {
                            return decodeTorrent.Uint8ArrayToString(p)
                        }).join("/")
                    })
                }

                return {
                    multiDir: multiDir,
                    files: files,
                }
            }
        };
    }]);
}());
