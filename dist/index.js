"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMaxPriceForDti = exports.estimateMonthlyPayment = exports.calculateAffordability = exports.calculateScoreAtPrice = exports.calculateScoreFromValues = exports.calculateScore = void 0;
__exportStar(require("./types"), exports);
var calculator_1 = require("./calculator");
Object.defineProperty(exports, "calculateScore", { enumerable: true, get: function () { return calculator_1.calculateScore; } });
Object.defineProperty(exports, "calculateScoreFromValues", { enumerable: true, get: function () { return calculator_1.calculateScoreFromValues; } });
Object.defineProperty(exports, "calculateScoreAtPrice", { enumerable: true, get: function () { return calculator_1.calculateScoreAtPrice; } });
Object.defineProperty(exports, "calculateAffordability", { enumerable: true, get: function () { return calculator_1.calculateAffordability; } });
Object.defineProperty(exports, "estimateMonthlyPayment", { enumerable: true, get: function () { return calculator_1.estimateMonthlyPayment; } });
Object.defineProperty(exports, "calculateMaxPriceForDti", { enumerable: true, get: function () { return calculator_1.calculateMaxPriceForDti; } });
