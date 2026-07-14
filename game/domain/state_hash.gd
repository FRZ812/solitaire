extends RefCounted
class_name TacticalStateHash


static func of_state(state) -> String:
	return of_value(state.to_snapshot(true))


static func of_value(value: Variant) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(canonical_text(value).to_utf8_buffer())
	return context.finish().hex_encode()


static func canonical_text(value: Variant) -> String:
	match typeof(value):
		TYPE_NIL:
			return "null"
		TYPE_BOOL:
			return "true" if value else "false"
		TYPE_INT:
			return str(int(value))
		TYPE_FLOAT:
			return "%.9f" % float(value)
		TYPE_STRING, TYPE_STRING_NAME:
			return JSON.stringify(str(value))
		TYPE_ARRAY:
			var array_parts: Array = []
			for item in value:
				array_parts.append(canonical_text(item))
			return "[" + ",".join(array_parts) + "]"
		TYPE_DICTIONARY:
			var dictionary: Dictionary = value
			var keys: Array = dictionary.keys()
			keys.sort_custom(func(a: Variant, b: Variant) -> bool: return str(a) < str(b))
			var dictionary_parts: Array = []
			for key in keys:
				dictionary_parts.append(JSON.stringify(str(key)) + ":" + canonical_text(dictionary[key]))
			return "{" + ",".join(dictionary_parts) + "}"
		_:
			return JSON.stringify(str(value))
