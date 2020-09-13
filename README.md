[English](https://github.com/wenjunxiao/json-to-dart/blob/master/README.md) | [中文简体](https://github.com/wenjunxiao/json-to-dart/blob/master/README-ZH.md)

# json-to-dart

  Generate `dart` class from `json` data, used for serialization and deserialization.
  This is usefull for flutter to generate models of api.
  Moreover, the original JSON data can be reversed when the generated file is generated,
  or it can be rebuildable according to the modification.

## Install

```bash
$ npm install -g json-to-dart
```

## Usage

  View usage help.
```bash
$ json2dart --help
```

### Generate

#### Generate from stdin

  Execute the following command, you will be prompted to enter JSON
```bash
$ json2dart --name Accounts --yes
```
  You can copy json from anywhere, and then paste it into the console.

#### Generate from json file

```bash
$ json2dart --name Accounts --yes --from accounts.json
```

#### Generate from http

```bash
$ json2dart --name Accounts --yes --from http://url/of/accounts.json
```

### Modify and Rebuild
  If your data structure has been adjusted, such as adding new fields,
  or you want to rename the generated class, you can choose to regenerate it 
  with the complete JSON data. But at this time, you may have discarded the
  original JSON data. It is a bit troublesome to obtain the new JSON data. 
  What should I do? Don’t worry, all valid configuration and JSON data
  have been included in the documentation comments `{@tool json2dart }` and `{@end-tool}`.

```dart
/// {@tool json2dart --name Accounts}
/// * items: `<AccountItem>[]`
/// * summary: `AccountSummary()`
/// * months: `<String, AccountsMonthItem>{"2020-08":{}}`
/// * count: `1`
/// {@end-tool}
...
/// {@tool json2dart --name AccountsMonthItem}
/// * blance: `38.9`
/// {@end-tool}
```
  If you want to change `AccountsMonthItem` to `AccMonthItem`, 
  and add a new field `description`,  Just modify the names in all documentation comments,
  the code in the file does not need to be modified, and then rebuild.

```dart
/// {@tool json2dart --name Accounts}
/// * items: `<AccountItem>[]`
/// * summary: `AccountSummary()`
/// * months: `<String, AccMonthItem>{"2020-08":{}}`
/// * count: `1`
/// {@end-tool}
...
/// {@tool json2dart --name AccMonthItem}
/// * blance: `38.9`
/// * description: `"Description"`
/// {@end-tool}
```
  Rebuild with `--dry-run` option to view and compare the output first
```bash
$ json2dart --name Accounts --rebuild lib/models/accounts.dart --dry-run
```
  And then use `-f` or `--force` to save
```bash
$ json2dart --name Accounts --rebuild lib/models/accounts.dart -f
```

## Configration

  The json file `.json2dart` in project root directory provider global config.
```json
{
  "picker": {
    "path.of.data": {
      "path.of.required.key1": true,
      "path.of.required.key2": true,
      "path.of.not.exist.key": false
    }
  },
  "array": ["list", "items"],
  "variables": ["json", "j", "d", "_json"],
  "dir": "lib/models", 
  "formatter": "dartfmt",
  "maxComment": 0,
  "fromOption": {// Can be an object or a file name
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

* `picker` Pick up real object json from input json. This is usefull when json is wrapped.
* `array` General array field, which will be ignored when naming the class by default.
* `variables` List of available variables, used to solve the problem of naming conflicts in generated methods
* `dir` The default directory for storing code
* `formatter` code formatting tool command
* `maxComment` The max commnet length of object, used to redundantly store JSON data in comments
* `fromOption` The options used to fetch JSON data from file/url. Usually an option for http request, such as headers, etc.

 For example, [example/.json2dart](example/.json2dart)
```json
{
  "picker": {
    "api.data": {
      "api.success": true,
      "api.error": true,
      "api.error.code": false
    }
  },
  "array": ["list", "items"]
}
```

  If the input json with name `Test`.
```json
{
  "api": {
    "success": true,
    "data": {
      "count": 1,
      "items": [{
        "id": 1,
        "name": "name"
      }]
    },
    "error": null
  }
}
```
  The real object json is
```json
{
  "count": 1,
  "items": [{
    "id": 1,
    "name": "name"
  }]
}
```
  And there two class: `Test` and `TestItem`, 
  [example/lib/models/test.dart](example/lib/models/test.dart)
