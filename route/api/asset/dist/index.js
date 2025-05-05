"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var express_1 = require("express");
var load_1 = require("../../../middleware/load");
var user_token_1 = require("../../../middleware/user-token");
var constants_1 = require("../../../constants");
var asset_1 = require("../../../db-handler/asset");
var sanitizer_1 = require("../../../util/sanitizer");
var data_provider_cryptocurrency_1 = require("../../../external-api/data-provider-cryptocurrency");
var data_provider_stock_1 = require("../../../external-api/data-provider-stock");
var ONE_WEEK_IN_MINUTES = 10080;
var ONE_WEEK_IN_MS = ONE_WEEK_IN_MINUTES * 60 * 1000;
var refreshAsset = function (mySQLPool, asset) { return __awaiter(void 0, void 0, void 0, function () {
    var externalAsset, _a, _b, externalSearchForDBStockISIN;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = asset.type;
                switch (_a) {
                    case "cryptocurrency": return [3 /*break*/, 1];
                    case "stock": return [3 /*break*/, 3];
                }
                return [3 /*break*/, 5];
            case 1: return [4 /*yield*/, data_provider_cryptocurrency_1["default"].getCryptocurrencyProfile(asset.id)];
            case 2:
                externalAsset = _c.sent();
                return [3 /*break*/, 6];
            case 3: return [4 /*yield*/, data_provider_stock_1["default"].getStockProfile(asset.symbol)];
            case 4:
                externalAsset = _c.sent();
                return [3 /*break*/, 6];
            case 5: throw new Error("Unknown asset type");
            case 6:
                if (!externalAsset) {
                    throw new Error("Nothing returned from external source");
                }
                _b = asset.type;
                switch (_b) {
                    case "cryptocurrency": return [3 /*break*/, 7];
                    case "stock": return [3 /*break*/, 8];
                }
                return [3 /*break*/, 19];
            case 7: return [3 /*break*/, 20];
            case 8:
                if (!(externalAsset.id != asset.id)) return [3 /*break*/, 18];
                /**
                * @dev If this happens then it means that the the symbol now belongs to a different company.
                */
                // Set the symbol of the dBStock to "0" (considered unknown)
                return [4 /*yield*/, asset_1["default"].markAssetSymbolUnknown(mySQLPool, asset.id)];
            case 9:
                /**
                * @dev If this happens then it means that the the symbol now belongs to a different company.
                */
                // Set the symbol of the dBStock to "0" (considered unknown)
                _c.sent();
                return [4 /*yield*/, asset_1["default"].getAsset(mySQLPool, externalAsset.id)];
            case 10:
                if (!((_c.sent()).length > 0)) return [3 /*break*/, 12];
                // Stock with ISIN provided from external source already exists -> Update it
                return [4 /*yield*/, asset_1["default"].updateAsset(mySQLPool, externalAsset)];
            case 11:
                // Stock with ISIN provided from external source already exists -> Update it
                _c.sent();
                return [3 /*break*/, 14];
            case 12: return [4 /*yield*/, asset_1["default"].createAsset(mySQLPool, externalAsset)];
            case 13:
                _c.sent();
                _c.label = 14;
            case 14: return [4 /*yield*/, data_provider_stock_1["default"].queryForStockByIsin(asset.id)];
            case 15:
                externalSearchForDBStockISIN = _c.sent();
                if (!externalSearchForDBStockISIN) return [3 /*break*/, 17];
                return [4 /*yield*/, asset_1["default"].updateAsset(mySQLPool, externalSearchForDBStockISIN)];
            case 16:
                _c.sent();
                return [3 /*break*/, 18];
            case 17:
                console.warn("Nothing was found for ISIN \"" + asset.id + "\". symbol will remain 0");
                _c.label = 18;
            case 18: return [3 /*break*/, 20];
            case 19: throw new Error("Unknown asset type");
            case 20: return [2 /*return*/];
        }
    });
}); };
var processNewAsset = function (mySQLPool, id) { return __awaiter(void 0, void 0, Promise, function () {
    var externalCryptocurrency, externalStock;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, data_provider_cryptocurrency_1["default"].getCryptocurrencyProfile(id)];
            case 1:
                externalCryptocurrency = _a.sent();
                return [4 /*yield*/, data_provider_stock_1["default"].getStockProfile(id)];
            case 2:
                externalStock = _a.sent();
                if (!externalStock && !externalCryptocurrency) {
                    throw new Error("Nothing found for symbol");
                }
                if (!externalStock) return [3 /*break*/, 4];
                return [4 /*yield*/, asset_1["default"].createAsset(mySQLPool, externalStock)];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4:
                if (!externalCryptocurrency) return [3 /*break*/, 6];
                return [4 /*yield*/, asset_1["default"].createAsset(mySQLPool, externalCryptocurrency)];
            case 5:
                _a.sent();
                _a.label = 6;
            case 6: return [2 /*return*/];
        }
    });
}); };
exports["default"] = (function (mySQLPool) {
    return express_1["default"].Router().get(
    /**
    * @desc Get asset profile
    * @param id {string}
    */
    "/profile/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var response, id, dBAsset, _a, _b, _c, _d, error_1, error_2, _e, _f, _g, _h, error_3;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    response = {
                        processedUnknownAsset: false,
                        refreshAssetRequired: false,
                        asset: null
                    };
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, 14, , 15]);
                    id = req.params.id;
                    return [4 /*yield*/, asset_1["default"].getAsset(mySQLPool, id)];
                case 2:
                    dBAsset = _j.sent();
                    if (!(dBAsset.length > 0)) return [3 /*break*/, 8];
                    response.refreshAssetRequired = ONE_WEEK_IN_MS < (new Date()).getTime() - (new Date(dBAsset[0].refreshed)).getTime();
                    if (!!response.refreshAssetRequired) return [3 /*break*/, 4];
                    _b = (_a = res.status(constants_1.HTTPStatus.ACCEPTED)).json;
                    _c = [__assign({}, response)];
                    _d = {};
                    return [4 /*yield*/, asset_1["default"].getAsset(mySQLPool, id)];
                case 3:
                    _b.apply(_a, [__assign.apply(void 0, _c.concat([(_d.asset = (_j.sent())[0], _d)]))]);
                    return [2 /*return*/];
                case 4:
                    _j.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, refreshAsset(mySQLPool, dBAsset[0])];
                case 5:
                    _j.sent();
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _j.sent();
                    res.status(constants_1.HTTPStatus.BAD_REQUEST).json({ message: error_1 });
                    return [3 /*break*/, 7];
                case 7: return [3 /*break*/, 13];
                case 8:
                    _j.trys.push([8, 10, , 11]);
                    return [4 /*yield*/, processNewAsset(mySQLPool, id)];
                case 9:
                    _j.sent();
                    return [3 /*break*/, 11];
                case 10:
                    error_2 = _j.sent();
                    res.status(constants_1.HTTPStatus.BAD_REQUEST).json({ message: error_2 });
                    return [2 /*return*/];
                case 11:
                    _f = (_e = res.status(constants_1.HTTPStatus.ACCEPTED)).json;
                    _g = [__assign({}, response)];
                    _h = { processedUnknownAsset: true };
                    return [4 /*yield*/, asset_1["default"].getAsset(mySQLPool, id)];
                case 12:
                    _f.apply(_e, [__assign.apply(void 0, _g.concat([(_h.asset = (_j.sent())[0], _h)]))]);
                    _j.label = 13;
                case 13: return [3 /*break*/, 15];
                case 14:
                    error_3 = _j.sent();
                    if (error_3 instanceof Error) {
                        res.status(constants_1.HTTPStatus.INTERNAL_SERVER_ERROR).json({
                            message: constants_1.INTERNAL_SERVER_ERROR + ": " + error_3.message
                        });
                        return [2 /*return*/];
                    }
                    res.status(constants_1.HTTPStatus.INTERNAL_SERVER_ERROR).json({
                        message: constants_1.INTERNAL_SERVER_ERROR + ": Unknown error"
                    });
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    }); }).get(
    /**
    * @desc Search for asset in DB
    * @param query {string}
    */
    "/search/:query", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var response, query, symbol, _a, error_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    response = {
                        assets: []
                    };
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    query = req.params.query;
                    symbol = sanitizer_1.sanitizeSymbolQuery(query);
                    if (symbol == "QUERY") {
                        res.status(constants_1.HTTPStatus.BAD_REQUEST).send("❌ Invalid query passed");
                        return [2 /*return*/];
                    }
                    _a = response;
                    return [4 /*yield*/, asset_1["default"].getAssetByLikeSymbol(mySQLPool, symbol)];
                case 2:
                    _a.assets = _b.sent();
                    res.status(constants_1.HTTPStatus.ACCEPTED).json(response);
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _b.sent();
                    if (error_4 instanceof Error) {
                        res.status(constants_1.HTTPStatus.INTERNAL_SERVER_ERROR).json({
                            message: constants_1.INTERNAL_SERVER_ERROR + ": " + error_4.message
                        });
                        return [2 /*return*/];
                    }
                    res.status(constants_1.HTTPStatus.INTERNAL_SERVER_ERROR).json({
                        message: constants_1.INTERNAL_SERVER_ERROR + ": Unknown error"
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }).get(
    /**
    * @desc Search for a stock from the external source
    * @param query {string} to search for
    */
    "/search-external/:query", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var response, query, symbol, externalQueryResults, _a, i, i, error_5;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    response = {
                        assets: []
                    };
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    query = req.params.query;
                    symbol = sanitizer_1.sanitizeSymbolQuery(query);
                    if (symbol == "QUERY") {
                        res.status(constants_1.HTTPStatus.BAD_REQUEST).send("❌ Invalid query passed");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, data_provider_stock_1["default"].queryForStock(symbol)];
                case 2:
                    _a = [_b.sent()];
                    return [4 /*yield*/, data_provider_cryptocurrency_1["default"].queryForCryptocurrency(symbol)];
                case 3:
                    externalQueryResults = __spreadArrays.apply(void 0, _a.concat([_b.sent()]));
                    for (i = 0; i < externalQueryResults.length; i++) {
                        try {
                            if (platforms.includes(externalQueryResults[i].platform.toLowerCase())) {
                                response.assets.push(externalQueryResults[i]);
                            }
                        }
                        catch (error) {
                            console.warn("Element has unsupported platform:", externalQueryResults[i]);
                            continue;
                        }
                    }
                    for (i = 0; i < response.assets.length; i++) {
                        response.assets[i];
                    }
                    res.status(constants_1.HTTPStatus.ACCEPTED).json(response);
                    return [3 /*break*/, 5];
                case 4:
                    error_5 = _b.sent();
                    if (error_5 instanceof Error) {
                        res.status(constants_1.HTTPStatus.INTERNAL_SERVER_ERROR).json({
                            message: constants_1.INTERNAL_SERVER_ERROR + ": " + error_5.message
                        });
                        return [2 /*return*/];
                    }
                    res.status(constants_1.HTTPStatus.INTERNAL_SERVER_ERROR).json({
                        message: constants_1.INTERNAL_SERVER_ERROR + ": Unknown error"
                    });
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); })["delete"](
    /**
    * @route DELETE /api/stock/delete
    * @desc Delete assset
    * @access authorized:admin
    */
    "/:id", user_token_1["default"].userTokenDecodeAdmin(mySQLPool), load_1.loadRequired(), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var id, existingStock, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = req.params.id;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    if (!id) {
                        res.status(constants_1.HTTPStatus.BAD_REQUEST).send("Asset id is required");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, asset_1["default"].getAsset(mySQLPool, id)];
                case 2:
                    existingStock = _a.sent();
                    if (existingStock.length === 0) {
                        res.status(constants_1.HTTPStatus.NOT_FOUND).send("Stock not found");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, asset_1["default"].deleteAsset(mySQLPool, id)];
                case 3:
                    _a.sent();
                    res.status(constants_1.HTTPStatus.OK).send("Deleted stock");
                    return [3 /*break*/, 5];
                case 4:
                    error_6 = _a.sent();
                    if (error_6 instanceof Error) {
                        res.status(constants_1.HTTPStatus.INTERNAL_SERVER_ERROR).json({
                            message: constants_1.INTERNAL_SERVER_ERROR + ": " + error_6.message
                        });
                        return [2 /*return*/];
                    }
                    res.status(constants_1.HTTPStatus.INTERNAL_SERVER_ERROR).json({
                        message: constants_1.INTERNAL_SERVER_ERROR + ": Unknown error"
                    });
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
});
