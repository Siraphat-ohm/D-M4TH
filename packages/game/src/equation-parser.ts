export interface EquationToken {
  label: string;
  value: number;
}

export interface EquationResult {
  expression: string;
  value: number;
}

const MAX_CONCATENATED_DIGITS = 3;
const EPSILON = 0.000001;

export function validateEquation(tokens: readonly EquationToken[]): EquationResult {
  const labels = normalizeLabels(tokens.map((token) => token.label));
  const expressions = splitExpressions(labels);
  const values = expressions.map(evaluateExpression);
  const expectedValue = values[0];
  const allEqual = values.every((value) => Math.abs(value - expectedValue) < EPSILON);

  if (!allEqual) {
    throw new Error("Chained equality expressions must resolve to the same value");
  }

  return {
    expression: labels.join(" "),
    value: expectedValue
  };
}

function normalizeLabels(labels: readonly string[]): string[] {
  return labels.map((label) => {
    if (label === "*") {
      return "×";
    }

    if (label === "/") {
      return "÷";
    }

    return label;
  });
}

function splitExpressions(labels: readonly string[]): string[][] {
  const expressions: string[][] = [[]];

  for (const label of labels) {
    if (label === "=") {
      expressions.push([]);
    } else {
      expressions[expressions.length - 1].push(label);
    }
  }

  if (expressions.length < 2 || expressions.some((expression) => expression.length === 0)) {
    throw new Error("Equation must contain non-empty expressions separated by equals signs");
  }

  return expressions;
}

function evaluateExpression(labels: readonly string[]): number {
  const parser = new ArithmeticParser(labels);
  const value = parser.parseExpression();
  parser.ensureComplete();
  return value;
}

class ArithmeticParser {
  private index = 0;

  constructor(private readonly labels: readonly string[]) {}

  parseExpression(): number {
    let value = this.parseTerm();

    while (this.match("+") || this.match("-")) {
      const operator = this.previous();
      const nextValue = this.parseTerm();
      value = operator === "+" ? value + nextValue : value - nextValue;
    }

    return value;
  }

  ensureComplete(): void {
    if (this.index < this.labels.length) {
      throw new Error(`Unexpected token ${this.labels[this.index]}`);
    }
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (this.match("×") || this.match("÷")) {
      const operator = this.previous();
      const nextValue = this.parseFactor();

      if (operator === "÷" && nextValue === 0) {
        throw new Error("Division by zero is invalid");
      }

      value = operator === "×" ? value * nextValue : value / nextValue;
    }

    return value;
  }

  private parseFactor(): number {
    if (this.match("-")) {
      const number = this.parseNumber();

      if (number === 0) {
        throw new Error("Unary minus is only allowed before a non-zero number");
      }

      return -number;
    }

    return this.parseNumber();
  }

  private parseNumber(): number {
    const start = this.index;
    const digits: string[] = [];

    while (this.index < this.labels.length && isDigit(this.labels[this.index])) {
      digits.push(this.labels[this.index]);
      this.index += 1;
    }

    if (digits.length > 0) {
      return parseConcatenatedDigits(digits);
    }

    const atom = this.labels[this.index];

    if (isWholeNumber(atom)) {
      this.index += 1;
      return Number(atom);
    }

    throw new Error(`Expected number at token ${start}`);
  }

  private match(label: string): boolean {
    if (this.labels[this.index] !== label) {
      return false;
    }

    this.index += 1;
    return true;
  }

  private previous(): string {
    return this.labels[this.index - 1];
  }
}

function parseConcatenatedDigits(digits: readonly string[]): number {
  if (digits.length > MAX_CONCATENATED_DIGITS) {
    throw new Error("A number can use at most 3 concatenated digit tiles");
  }

  if (digits.length > 1 && digits[0] === "0") {
    throw new Error("Leading zero numbers are invalid");
  }

  return Number(digits.join(""));
}

function isDigit(label: string | undefined): boolean {
  return typeof label === "string" && /^[0-9]$/.test(label);
}

function isWholeNumber(label: string | undefined): boolean {
  return typeof label === "string" && /^(1[0-9]|20)$/.test(label);
}
