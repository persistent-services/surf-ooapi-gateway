function append_tag(tag, timestamp, record)
  new_record = record
  image_name = tag:sub(8)

  new_record["image_name"] = image_name
  return 1, timestamp, new_record
end