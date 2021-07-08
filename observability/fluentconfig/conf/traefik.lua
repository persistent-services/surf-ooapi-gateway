function add_short_message(tag, timestamp, record)
  if record["DownstreamStatus"] then
    new_record = record
    message = record["ClientHost"] .. " " .. record["ClientUsername"] .. " " .. record["RequestMethod"] .. " " .. record["RequestAddr"] .. " " .. record["RequestPath"] .. " " .. record["RequestProtocol"] .. " " .. record["DownstreamStatus"]
    new_record["short_message"] = message
    new_record["msg"] = nil
    return 1, timestamp, new_record
  elseif record["log"] then
    new_record = record
    new_record["short_message"] = record["log"]
    new_record["log"] = nil
    return 1, timestamp, new_record
  elseif record ["msg"] then
    new_record = record
    new_record["short_message"] = record["msg"]
    new_record["msg"] = nil
    return 1, timestamp, new_record
  else
    new_record = record
    new_record["short_message"] = ""
    return 1, timestamp, new_record
  end
end

function map_error_level(tag, timestamp, record)
  if record["level"] then
    new_record = record
    current_level = string.lower(record["level"])

    mapping = {
      ["panic"] = 0,
      ["fatal"] = 2,
      ["error"] = 3,
      ["warn"] = 4,
      ["info"] = 6,
      ["debug"] = 7
    }

    new_record["level"] = mapping[current_level]
    return 1, timestamp, new_record
  else
    return 0, timestamp, record
  end
end