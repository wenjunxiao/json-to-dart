import 'dart:convert';
import 'dart:io';

import 'lib/models/accounts.dart';

void main(List<String> args) {
  String file = new File('lib/models/accounts.json').readAsStringSync();
  Map<String, dynamic> data0 = json.decode(file)['data'];
  var obj = Accounts.fromJson(data0);
  var data1 = obj.toJson();
  print(json.encode(data1) == json.encode(data0));
}
