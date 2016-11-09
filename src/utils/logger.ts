export const ConsoleStyle = {
    Bright: (str: string) => "\x1b[1m" + str + "\x1b[0m",
    Dim: (str: string) => "\x1b[2m" + str + "\x1b[0m",
    Underscore: (str: string) => "\x1b[4m" + str + "\x1b[0m",
    Blink: (str: string) => "\x1b[5m" + str + "\x1b[0m",
    Reverse: (str: string) => "\x1b[7m" + str + "\x1b[0m",
    Hidden: (str: string) => "\x1b[8m" + str + "\x1b[0m",

    FgBlack: (str: string) => "\x1b[30m" + str + "\x1b[0m",
    FgRed: (str: string) => "\x1b[31m" + str + "\x1b[0m",
    FgGreen: (str: string) => "\x1b[32m" + str + "\x1b[0m",
    FgYellow: (str: string) => "\x1b[33m" + str + "\x1b[0m",
    FgBlue: (str: string) => "\x1b[34m" + str + "\x1b[0m",
    FgMagenta: (str: string) => "\x1b[35m" + str + "\x1b[0m",
    FgCyan: (str: string) => "\x1b[36m" + str + "\x1b[0m",
    FgWhite: (str: string) => "\x1b[37m" + str + "\x1b[0m",

    BgBlack: (str: string) => "\x1b[40m" + str + "\x1b[0m",
    BgRed: (str: string) => "\x1b[41m" + str + "\x1b[0m",
    BgGreen: (str: string) => "\x1b[42m" + str + "\x1b[0m",
    BgYellow: (str: string) => "\x1b[43m" + str + "\x1b[0m",
    BgBlue: (str: string) => "\x1b[44m" + str + "\x1b[0m",
    BgMagenta: (str: string) => "\x1b[45m" + str + "\x1b[0m",
    BgCyan: (str: string) => "\x1b[46m" + str + "\x1b[0m",
    BgWhite: (str: string) => "\x1b[47m" + str + "\x1b[0m",

    clear: () => "\x1b[2J\x1b[1;1H"
};


export class Logger {
    clear() {
        console.log(ConsoleStyle.clear());
    }

    log(arg: string) {
        console.log(arg);
    }

    info(arg: string) {
        this.log(ConsoleStyle.FgCyan(arg));
    }

    success(arg: string) {
        this.log(ConsoleStyle.FgGreen(arg));
    }

    help(arg: string) {
        this.log(ConsoleStyle.FgCyan(arg));
    }

    warning(arg: string) {
        this.log(ConsoleStyle.FgYellow(arg));
    }

    error(arg: string) {
        this.log(ConsoleStyle.Dim(ConsoleStyle.FgRed(arg)));
    }

    data(arg: string) {
        this.log(ConsoleStyle.FgWhite(arg));
    }
}

export const logger = new Logger();