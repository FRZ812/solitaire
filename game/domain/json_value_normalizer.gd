extends RefCounted
class_name TacticalJsonValueNormalizer

## JSON has one number type, so Godot parses every serialized integer as a
## float. Tactical state is integer based; normalize integral values at the
## persistence boundary before state hashing or replay execution.


static func normalize(value: Variant) -> Variant:
	match typeof(value):
		TYPE_FLOAT:
			var number := float(value)
			return int(number) if number == floor(number) else number
		TYPE_ARRAY:
			var normalized_array: Array = []
			for item in Array(value):
				normalized_array.append(normalize(item))
			return normalized_array
		TYPE_DICTIONARY:
			var normalized_dictionary: Dictionary = {}
			for key in Dictionary(value).keys():
				normalized_dictionary[key] = normalize(Dictionary(value)[key])
			return normalized_dictionary
		_:
			return value
