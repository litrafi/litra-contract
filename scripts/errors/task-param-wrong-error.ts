export class TaskParamWrongError extends Error {
    constructor(
        paramKey: string,
        param: string,
        msg: string
    ) {
        super(`task param ${paramKey} is wrong ! actual value is ${param}. ${msg}`)
    }
}