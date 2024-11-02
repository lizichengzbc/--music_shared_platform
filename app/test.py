def parse(query_string):
    result = {}
    # 用 "&" 分割字符串，将其分成每一个 "key=value" 的部分
    pairs = query_string.split("&")

    # 遍历每个 "key=value" 对
    for pair in pairs:
        # 分割每个对，得到 key 和 value
        key, value = pair.split("=")
        result[key] = value

    return result


# 测试
query_string = "KugooID=1188922775&KugooPwd=2132A561954618C007BACBB47738AC29&NickName=%u7406%u667a%u57ce&Pic=http://imge.kugou.com/kugouicon/165/20210123/20210123162000153054.jpg&RegState=1&RegFrom=&t=9db06ee5df6575d2c567548362cb837a743ed2380bdd0ea3c27b0d673ba415da&a_id=1014&ct=1730127792&UserName=%u006b%u0067%u006f%u0070%u0065%u006e%u0031%u0031%u0038%u0038%u0039%u0032%u0032%u0037%u0037%u0035&t1="
parsed_result = parse(query_string)
print(parsed_result)
