export function success(body, json=true) {
    if (json) return jsonBuildResponse(200, body);
    else return rawBuildResponse(200, body);
}

export function failure(body, json=true) {
    if (json) return jsonBuildResponse(500, body);
    else return rawBuildResponse(500, body);
}

export const response = {
    success: (body) => jsonBuildResponse(200, body),
    failure: (body) => jsonBuildResponse(500, body),
    badrequest: (body) => jsonBuildResponse(400, body),
    unauthorized: (body) => jsonBuildResponse(401, body),
    notfound: (body) => jsonBuildResponse(404, body),
    redirect: (location) => jsonBuildResponse(302, undefined, {Location: location}),
    rawsuccess: (body) => rawBuildResponse(200, body),
    xmlsuccess: (body) => xmlBuildResponse(200, body),
    rawfailure: (body) => rawBuildResponse(500, body),
    rawbadrequest: (body) => rawBuildResponse(400, body),
    rawunauthorized: (body) => rawBuildResponse(401, body),
    rawnotfound: (body) => rawBuildResponse(404, body),
};

function jsonBuildResponse(statusCode, body, headers = {}) {
    return {
        statusCode: statusCode,
        headers: {
            ...headers,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true
        },
        body: JSON.stringify(body)
    };
}
function rawBuildResponse(statusCode, body, headers = {}) {
    return {
        statusCode: statusCode,
        headers: {
            ...headers,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true
        },
        body: body
    };
}
function xmlBuildResponse(statusCode, body, headers = {}) {
    return {
        statusCode: statusCode,
        headers: {
            ...headers,
            "Content-Type": "text/xml; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true
        },
        body: body
    };
}
