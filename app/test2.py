import requests

cookies = {
    'kg_mid': '6d4d530818a27b553ba41a17362933f5',
    'kg_dfid': '2UH1uW2PAhfO0Ixej936Dvvr',
    'kg_dfid_collect': 'd41d8cd98f00b204e9800998ecf8427e',
    'Hm_lvt_aedee6983d4cfc62f509129360d6bb3d': '1730121006',
    'HMACCOUNT': '1E9D099A48F16F67',
    'kg_mid_temp': '6d4d530818a27b553ba41a17362933f5',
    'Hm_lpvt_aedee6983d4cfc62f509129360d6bb3d': '1730129210',
}

headers = {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'cache-control': 'no-cache',
    # 'content-length': '0',
    # 'cookie': 'kg_mid=6d4d530818a27b553ba41a17362933f5; kg_dfid=2UH1uW2PAhfO0Ixej936Dvvr; kg_dfid_collect=d41d8cd98f00b204e9800998ecf8427e; Hm_lvt_aedee6983d4cfc62f509129360d6bb3d=1730121006; HMACCOUNT=1E9D099A48F16F67; kg_mid_temp=6d4d530818a27b553ba41a17362933f5; Hm_lpvt_aedee6983d4cfc62f509129360d6bb3d=1730129210',
    'origin': 'https://login-user.kugou.com',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://login-user.kugou.com/',
    'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
}

params = {
    'appid': '1014',
    'clientver': '1000',
    'clienttime': '1730129220',
    'mid': '6d4d530818a27b553ba41a17362933f5',
    'uuid': '6d4d530818a27b553ba41a17362933f5',
    'dfid': '2UH1uW2PAhfO0Ixej936Dvvr',
    'dev': 'web',
    'userid': '1188922775',
    'plat': '4',
    'clienttime_ms': '1730129220741',
    'pk': '028f141063e8718f0f1d37af14e8dcbf7e739a9b3c768689b2b3f38939faf57ac8d5e8d3d8698834159fa6d0ecc9014a467aa72524314d493dabb45fa2a89c2749066f6b966391316d90a0fab8840f2db2155af7d396ef9c3cd32f15966e01faada455f184ba0c861a8a0087b3525317b11ce0c445da52371387f97b4a046001',
    'params': 'be960480a57980b652814e8b9b54f2592278778fb8a4c3bf254c1589eb04a9c3248663890e94fdc6530b3d730a9ba24c36388553173df0df2290b4a4197323b8bb2c2b1d3cf8879afcb663912df6c0b5',
    'srcappid': '2919',
    'signature': 'AD69626F172D763D67D69D7088FA13E2',
}

response = requests.post('https://loginservice.kugou.com/v1/login_by_token_get', params=params, headers=headers)

print(response.status_code)
print(response.cookies)

import requests

cookies = {
    'kg_mid': '6d4d530818a27b553ba41a17362933f5',
    'kg_dfid': '2UH1uW2PAhfO0Ixej936Dvvr',
    'kg_dfid_collect': 'd41d8cd98f00b204e9800998ecf8427e',
    'Hm_lvt_aedee6983d4cfc62f509129360d6bb3d': '1730121006',
    'HMACCOUNT': '1E9D099A48F16F67',
    'Hm_lpvt_aedee6983d4cfc62f509129360d6bb3d': '1730130289',
    'kg_mid_temp': '6d4d530818a27b553ba41a17362933f5',
}

headers = {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'cache-control': 'no-cache',
    # 'content-length': '0',
    # 'cookie': 'kg_mid=6d4d530818a27b553ba41a17362933f5; kg_dfid=2UH1uW2PAhfO0Ixej936Dvvr; kg_dfid_collect=d41d8cd98f00b204e9800998ecf8427e; Hm_lvt_aedee6983d4cfc62f509129360d6bb3d=1730121006; HMACCOUNT=1E9D099A48F16F67; Hm_lpvt_aedee6983d4cfc62f509129360d6bb3d=1730130289; kg_mid_temp=6d4d530818a27b553ba41a17362933f5',
    'origin': 'https://login-user.kugou.com',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://login-user.kugou.com/',
    'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
}

params = {
    'appid': '1014',
    'clientver': '1000',
    'clienttime': '1730130307',
    'mid': '6d4d530818a27b553ba41a17362933f5',
    'uuid': '6d4d530818a27b553ba41a17362933f5',
    'dfid': '2UH1uW2PAhfO0Ixej936Dvvr',
    'dev': 'web',
    'userid': '1188922775',
    'plat': '4',
    'clienttime_ms': '1730130307426',
    'pk': '324f636a838e6f5fb26244e6aebf3270ebf6ac395a002a5ff6937cf0649481ef7fc2f7069f491a4d19b67b617b58edcbd20a8b89353ce0d2672359a38afefb5214176ac76fea0e65959343367aed3254207420b42b8079d1c29a5fe967112bf9a6d569cc84ced38308cd315e416902ed7e4e0c0a0e8cdd66ca5c9ad391bdb053',
    'params': '1feddd831c090687dc478e5d0fb2bcf9c72dc5419e862cfce91051c4df8ccc4486b4e8e18ca6697b1bedff20289029c42c459d42d6ec876aa28d46fa94bfae672b52efdc2666eb300115531e633aca81',
    'srcappid': '2919',
    'signature': '1B250EED7D81F80954BFEA6CC3077EBD',
}

response = requests.post('https://loginservice.kugou.com/v1/login_by_token_get', params=params, cookies=cookies, headers=headers)
